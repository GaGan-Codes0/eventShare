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
import { MULTIPART_THRESHOLD_BYTES, PREVIEW_MAX_EDGE, THUMB_MAX_EDGE } from '@eventshare/shared';
import * as Crypto from 'expo-crypto';
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { AppState, Platform } from 'react-native';

import { setUploadKeepAlive } from '../../../modules/upload-keepalive';

import { api, isRetryable } from '@/services/api/client';

export type QueueItem = {
  id: string; // clientUploadId
  eventId: string;
  fileName: string;
  /** Empty for voice notes, which have no preview. */
  thumbName: string;
  /** Mid-size JPEG shown when a photo is opened. Older items and videos have none. */
  previewName?: string;
  previewByteSize?: number;
  /** A big file going up in pieces: which upload, and the pieces storage has confirmed. */
  multipartId?: string;
  doneParts?: { number: number; etag: string }[];
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
/**
 * How many uploads are started at once. A few on Android. More on iPhone, because that hands them
 * to the system straight away, while the app is on screen: iPhone sends what it was given even
 * after the app goes to sleep (and may hold back anything started once it's already asleep). It
 * limits how many actually run at the same moment by itself, so this doesn't flood venue Wi-Fi.
 */
const MAX_PARALLEL_UPLOADS = Platform.OS === 'ios' ? 12 : 3;
/** Pieces of a big file on their way at once. iPhone: as many as fit, so they go while it sleeps. */
const PIECES_AT_ONCE = Platform.OS === 'ios' ? 100 : 3;
/** Queued pieces are temporary copies: always leave the phone this much room. */
const KEEP_FREE_BYTES = 500 * 1024 * 1024;
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

let keptAlive = false;
let preparing = 0;

function emit() {
  items = [...items];
  listeners.forEach((l) => l());
  syncKeepAlive();
}

function syncKeepAlive() {
  const working = preparing > 0 || items.some((i) => !i.permanent);
  if (working !== keptAlive) {
    keptAlive = working;
    setUploadKeepAlive(working);
  }
}

/**
 * iPhone: photos or videos are about to be queued. The phone freezes the app within seconds of it
 * leaving the screen unless background time was asked for first, so it's asked for up front.
 * (Android doesn't freeze it that quickly, and would flash its notification for nothing.)
 */
export function startPreparing() {
  if (Platform.OS !== 'ios') return;
  preparing += 1;
  syncKeepAlive();
}

export function endPreparing() {
  if (Platform.OS !== 'ios') return;
  preparing = Math.max(0, preparing - 1);
  syncKeepAlive();
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
  AppState.addEventListener('change', (state) => state === 'active' && kick());
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
  let preview: File | null = null;
  if (kind === 'photo') {
    // Worth having, but never a reason to lose the shot.
    try {
      const rendered = await ImageManipulator.manipulate(original.uri, { maxWidth: PREVIEW_MAX_EDGE, maxHeight: PREVIEW_MAX_EDGE }).renderAsync();
      const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
      preview = new File(dir, `${id}-preview.jpg`);
      await new File(saved.uri).move(preview);
    } catch {
      preview = null;
    }
  }
  if (kind !== 'voice') {
    // From the preview when there is one: decoding that is much quicker than the full photo.
    const source = kind === 'video' ? (await getThumbnailAsync(original.uri, { time: 0, quality: 0.8 })).uri : (preview ?? original).uri;
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
    previewName: preview?.name,
    previewByteSize: preview?.size,
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
  for (const name of [item.fileName, item.thumbName, item.previewName]) {
    if (!name) continue;
    const f = new File(dir, name);
    if (f.exists) f.delete();
  }
  removePieces(item);
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
      previewByteSize: item.previewByteSize || undefined,
      multipart: item.byteSize >= MULTIPART_THRESHOLD_BYTES || undefined,
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
  // All at once: each is handed to the system, so they carry on if the app goes to sleep.
  await Promise.all([
    ticket.original && put(new File(dir, item.fileName), ticket.original),
    ticket.thumb && item.thumbName && put(new File(dir, item.thumbName), ticket.thumb),
    ticket.preview && item.previewName && put(new File(dir, item.previewName), ticket.preview),
  ]);
  const parts = ticket.multipart ? await putInPieces(item, ticket.multipart) : undefined;
  return api<Photo>(`/photos/${ticket.photoId}/complete`, { method: 'POST', body: parts ? { parts } : undefined });
}

function removePieces(item: QueueItem) {
  for (const entry of dir.list()) {
    if (entry instanceof File && entry.name.startsWith(`${item.id}.part`)) entry.delete();
  }
}

/**
 * Sends a big file in pieces, remembering each as it lands, so a dropped connection or a restart
 * only costs what was in flight. On iPhone many pieces are handed to the system up front, so the
 * video keeps going with the app asleep.
 */
async function putInPieces(item: QueueItem, multipart: NonNullable<UploadTicket['multipart']>) {
  // A different upload id means storage dropped the old one: its pieces are gone.
  if (item.multipartId !== multipart.uploadId) {
    item.multipartId = multipart.uploadId;
    item.doneParts = [];
    persist();
  }
  const waiting = multipart.parts.filter((part) => !item.doneParts?.some((d) => d.number === part.number));
  const room = Math.floor((Paths.availableDiskSpace - KEEP_FREE_BYTES) / multipart.partBytes);
  const handle = new File(dir, item.fileName).open(FileMode.ReadOnly);
  let next = 0;
  let failure: unknown = null;

  const sender = async () => {
    while (next < waiting.length && failure === null) {
      const part = waiting[next++];
      // Lets the screen draw between pieces.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const piece = new File(dir, `${item.id}.part${part.number}`);
      try {
        handle.offset = (part.number - 1) * multipart.partBytes;
        const bytes = handle.readBytesSync(multipart.partBytes);
        if (piece.exists) piece.delete();
        piece.create();
        piece.write(bytes);
        const res = await piece.upload(part.url, { httpMethod: 'PUT', sessionType: 'background' });
        if (res.status < 200 || res.status >= 300) throw new Error(`Storage upload failed (${res.status})`);
        const etag = Object.entries(res.headers).find(([k]) => k.toLowerCase() === 'etag')?.[1];
        if (!etag) throw new Error('Storage gave no tag for a piece');
        item.doneParts = [...(item.doneParts ?? []), { number: part.number, etag }];
        persist();
      } catch (err) {
        failure ??= err;
      } finally {
        if (piece.exists) piece.delete();
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.max(1, Math.min(PIECES_AT_ONCE, room, waiting.length)) }, sender));
  } finally {
    handle.close();
  }
  if (failure !== null) throw failure instanceof Error ? failure : new Error(String(failure));
  return item.doneParts ?? [];
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
