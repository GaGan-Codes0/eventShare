/**
 * Persistent upload queue — the "never lose a photo" guarantee.
 *
 * 1. A captured/picked photo is first COPIED into the app's documents folder (original bytes,
 *    untouched) and written to queue.json, before any network call.
 * 2. Uploads run a few at a time: ask the API for signed URLs → PUT original + thumbnail
 *    straight to storage → tell the API it's complete.
 * 3. Failures retry with backoff (offline, server errors). Files are deleted only after the API
 *    confirms the photo is ready. Each item's clientUploadId makes retries idempotent.
 */
import type { MediaKind, Photo, UploadTicket, UploadTarget } from '@eventshare/shared';
import { THUMB_MAX_EDGE } from '@eventshare/shared';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { AppState } from 'react-native';

import { api, isRetryable } from '@/services/api/client';

export type QueueItem = {
  id: string; // clientUploadId
  eventId: string;
  fileName: string;
  /** Empty for voice notes, which have no preview. */
  thumbName: string;
  /** Older items are all photos. */
  kind?: MediaKind;
  /** Videos and voice notes. */
  durationMs?: number;
  contentType: string;
  byteSize: number;
  thumbByteSize: number;
  width?: number;
  height?: number;
  takenAt?: string;
  /** Camera-roll picks are 'library' (the host can turn those off). Older items have none. */
  source?: 'camera' | 'library';
  /** The shot-list prompt it answers. */
  prompt?: string;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  /** The server has given this photo one of the uploader's slots (it counts in photosUsed). */
  reserved?: boolean;
  /** Set when the server rejected the upload for good (e.g. removed from the event). */
  error?: string;
  permanent?: boolean;
};

const dir = new Directory(Paths.document, 'uploads');
const queueFile = new File(dir, 'queue.json');

let items: QueueItem[] = [];
let loaded = false;
/** A few at a time: much faster on good connections, still gentle on venue Wi-Fi. */
const MAX_PARALLEL_UPLOADS = 3;
const inFlight = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const uploadedListeners = new Set<(photo: Photo) => void>();
const reservedListeners = new Set<(eventId: string) => void>();
/** Runs after each upload, with the photo still on the phone (Find my photos reads it). */
let afterUpload: ((item: QueueItem, photo: Photo, uri: string) => Promise<unknown>) | null = null;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
};

const DEFAULT_TYPE: Record<MediaKind, string> = { photo: 'image/jpeg', video: 'video/mp4', voice: 'audio/mp4' };

function emit() {
  items = [...items];
  listeners.forEach((l) => l());
}

function persist() {
  // Sync so back-to-back saves can't interleave and corrupt the file.
  queueFile.writeSync(JSON.stringify(items));
}

export function getQueue() {
  return items;
}

export function subscribeQueue(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Fires once per photo when it's live in the gallery. */
export function onPhotoUploaded(listener: (photo: Photo) => void) {
  uploadedListeners.add(listener);
  return () => {
    uploadedListeners.delete(listener);
  };
}

/** Fires when the server counts a queued photo against its owner's allowance. */
/** Something to do with each photo once it's uploaded, before the phone's copy is deleted. */
export function setAfterUpload(fn: typeof afterUpload) {
  afterUpload = fn;
}

export function onSlotReserved(listener: (eventId: string) => void) {
  reservedListeners.add(listener);
  return () => {
    reservedListeners.delete(listener);
  };
}

export async function initUploadQueue() {
  if (loaded) return;
  dir.create({ intermediates: true, idempotent: true });
  if (queueFile.exists) {
    try {
      items = JSON.parse(await queueFile.text()) as QueueItem[];
    } catch {
      items = [];
    }
  }
  loaded = true;
  emit();
  AppState.addEventListener('change', (s) => s === 'active' && kick());
  kick();
}

export async function enqueuePhoto(input: {
  eventId: string;
  uri: string;
  kind?: MediaKind;
  /** Videos and voice notes, in milliseconds. */
  durationMs?: number;
  contentType?: string | null;
  width?: number;
  height?: number;
  takenAt?: string;
  source: 'camera' | 'library';
  prompt?: string;
  /** The file is ours to take (a fresh recording, or the picker's copy): move it rather than copy. */
  move?: boolean;
}) {
  await initUploadQueue();
  const id = Crypto.randomUUID();
  const kind = input.kind ?? 'photo';
  const contentType = input.contentType && EXT[input.contentType] ? input.contentType : DEFAULT_TYPE[kind];

  // Keep the original exactly as captured. A long video can be gigabytes: never hold two copies.
  const original = new File(dir, `${id}.${EXT[contentType]}`);
  // copy/move are async: the file must be complete before we read it or its size.
  if (input.move) await new File(input.uri).move(original);
  else await new File(input.uri).copy(original);

  // Small preview for the gallery grid (originals are never recompressed): a photo downsampled
  // while decoding, a video's first frame. Voice notes have none.
  let thumb: File | null = null;
  if (kind !== 'voice') {
    const source = kind === 'video' ? (await getThumbnailAsync(original.uri, { time: 0, quality: 0.8 })).uri : original.uri;
    const rendered = await ImageManipulator.manipulate(source, { maxWidth: THUMB_MAX_EDGE, maxHeight: THUMB_MAX_EDGE }).renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
    thumb = new File(dir, `${id}-thumb.jpg`);
    await new File(saved.uri).move(thumb);
  }

  items.push({
    id,
    eventId: input.eventId,
    fileName: original.name,
    thumbName: thumb?.name ?? '',
    kind,
    durationMs: input.durationMs,
    contentType,
    byteSize: original.size,
    thumbByteSize: thumb?.size ?? 0,
    width: input.width,
    height: input.height,
    takenAt: input.takenAt,
    source: input.source,
    prompt: input.prompt,
    createdAt: Date.now(),
    attempts: 0,
    nextAttemptAt: 0,
  });
  persist();
  emit();
  kick();
  return id;
}

/** Drop an item the server rejected for good. */
export function discardItem(id: string) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  removeFiles(item);
  items = items.filter((i) => i.id !== id);
  persist();
  emit();
}

export function retryNow() {
  items.forEach((i) => {
    if (!i.permanent) i.nextAttemptAt = 0;
  });
  emit();
  kick();
}

function removeFiles(item: QueueItem) {
  for (const name of [item.fileName, item.thumbName]) {
    if (!name) continue;
    const f = new File(dir, name);
    if (f.exists) f.delete();
  }
}

async function put(file: File, target: UploadTarget) {
  const res = await file.upload(target.url, { httpMethod: 'PUT', headers: target.headers, sessionType: 'background' });
  if (res.status < 200 || res.status >= 300) throw new Error(`Storage upload failed (${res.status})`);
}

async function uploadOne(item: QueueItem) {
  const ticket = await api<UploadTicket>(`/events/${item.eventId}/photos/uploads`, {
    body: {
      clientUploadId: item.id,
      kind: item.kind ?? 'photo',
      durationMs: item.durationMs,
      contentType: item.contentType,
      byteSize: item.byteSize,
      thumbByteSize: item.thumbByteSize || undefined,
      width: item.width,
      height: item.height,
      takenAt: item.takenAt,
      source: item.source,
      prompt: item.prompt,
    },
  });
  if (!item.reserved) {
    item.reserved = true;
    persist();
    reservedListeners.forEach((l) => l(item.eventId));
  }
  if (ticket.original) await put(new File(dir, item.fileName), ticket.original);
  if (ticket.thumb && item.thumbName) await put(new File(dir, item.thumbName), ticket.thumb);
  return api<Photo>(`/photos/${ticket.photoId}/complete`, { method: 'POST' });
}

/** Starts uploads up to the limit. Safe to call any time. */
export function kick() {
  if (!loaded) return;
  const now = Date.now();
  for (const item of items) {
    if (inFlight.size >= MAX_PARALLEL_UPLOADS) break;
    if (item.permanent || item.nextAttemptAt > now || inFlight.has(item.id)) continue;
    inFlight.add(item.id);
    void runOne(item).finally(() => {
      inFlight.delete(item.id);
      kick();
      if (inFlight.size === 0) scheduleRetry();
    });
  }
}

async function runOne(next: QueueItem) {
  try {
    const photo = await uploadOne(next);
    // Not awaited: the next upload starts while this one's faces are being found.
    const after = afterUpload?.(next, photo, new File(dir, next.fileName).uri);
    if (after) void after.catch(() => undefined).finally(() => removeFiles(next));
    else removeFiles(next);
    items = items.filter((i) => i.id !== next.id);
    uploadedListeners.forEach((l) => l(photo));
  } catch (err) {
    next.attempts += 1;
    next.error = err instanceof Error ? err.message : String(err);
    if (isRetryable(err)) {
      // Randomised, so phones that lost the venue Wi-Fi together don't all come back together.
      next.nextAttemptAt = Date.now() + Math.min(2 ** next.attempts * 2000, 5 * 60_000) * (0.5 + Math.random());
    } else {
      next.permanent = true;
    }
  }
  persist();
  emit();
}

function scheduleRetry() {
  if (timer) clearTimeout(timer);
  const pending = items.filter((i) => !i.permanent);
  if (pending.length === 0) return;
  const wait = Math.max(1000, Math.min(...pending.map((i) => i.nextAttemptAt)) - Date.now());
  timer = setTimeout(kick, wait);
}
