/**
 * Persistent upload queue — the "never lose a photo" guarantee.
 *
 * 1. A captured/picked photo is first COPIED into the app's documents folder (original bytes,
 *    untouched) and written to queue.json, before any network call.
 * 2. A worker uploads items one by one: ask the API for signed URLs → PUT original + thumbnail
 *    straight to storage → tell the API it's complete.
 * 3. Failures retry with backoff (offline, server errors). Files are deleted only after the API
 *    confirms the photo is ready. Each item's clientUploadId makes retries idempotent.
 */
import type { Photo, UploadTicket, UploadTarget } from '@eventshare/shared';
import { THUMB_MAX_EDGE } from '@eventshare/shared';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { AppState } from 'react-native';

import { api, isRetryable } from '@/services/api/client';

export type QueueItem = {
  id: string; // clientUploadId
  eventId: string;
  fileName: string;
  thumbName: string;
  contentType: string;
  byteSize: number;
  thumbByteSize: number;
  width?: number;
  height?: number;
  takenAt?: string;
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
let running = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const uploadedListeners = new Set<(photo: Photo) => void>();
const reservedListeners = new Set<(eventId: string) => void>();

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/png': 'png',
  'image/webp': 'webp',
};

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
  contentType?: string | null;
  width?: number;
  height?: number;
  takenAt?: string;
}) {
  await initUploadQueue();
  const id = Crypto.randomUUID();
  const contentType = input.contentType && EXT[input.contentType] ? input.contentType : 'image/jpeg';

  // Keep the original exactly as captured.
  const original = new File(dir, `${id}.${EXT[contentType]}`);
  // copy/move are async: the file must be complete before we read it or its size.
  await new File(input.uri).copy(original);

  // Small preview for the gallery grid (originals are never recompressed).
  // Downsample while decoding so a full-size photo is never held in memory as one bitmap.
  const rendered = await ImageManipulator.manipulate(original.uri, {
    maxWidth: THUMB_MAX_EDGE,
    maxHeight: THUMB_MAX_EDGE,
  }).renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  const thumb = new File(dir, `${id}-thumb.jpg`);
  await new File(saved.uri).move(thumb);

  items.push({
    id,
    eventId: input.eventId,
    fileName: original.name,
    thumbName: thumb.name,
    contentType,
    byteSize: original.size,
    thumbByteSize: thumb.size,
    width: input.width,
    height: input.height,
    takenAt: input.takenAt,
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
      contentType: item.contentType,
      byteSize: item.byteSize,
      thumbByteSize: item.thumbByteSize,
      width: item.width,
      height: item.height,
      takenAt: item.takenAt,
    },
  });
  if (!item.reserved) {
    item.reserved = true;
    persist();
    reservedListeners.forEach((l) => l(item.eventId));
  }
  if (ticket.original && ticket.thumb) {
    await put(new File(dir, item.fileName), ticket.original);
    await put(new File(dir, item.thumbName), ticket.thumb);
  }
  return api<Photo>(`/photos/${ticket.photoId}/complete`, { method: 'POST' });
}

/** Starts the worker if it isn't running. Safe to call any time. */
export function kick() {
  if (!loaded || running) return;
  running = true;
  void (async () => {
    try {
      for (;;) {
        const now = Date.now();
        const next = items.find((i) => !i.permanent && i.nextAttemptAt <= now);
        if (!next) break;
        try {
          const photo = await uploadOne(next);
          removeFiles(next);
          items = items.filter((i) => i.id !== next.id);
          uploadedListeners.forEach((l) => l(photo));
        } catch (err) {
          next.attempts += 1;
          next.error = err instanceof Error ? err.message : String(err);
          if (isRetryable(err)) {
            next.nextAttemptAt = Date.now() + Math.min(2 ** next.attempts * 2000, 5 * 60_000);
          } else {
            next.permanent = true;
          }
        }
        persist();
        emit();
      }
    } finally {
      running = false;
      scheduleRetry();
    }
  })();
}

function scheduleRetry() {
  if (timer) clearTimeout(timer);
  const pending = items.filter((i) => !i.permanent);
  if (pending.length === 0) return;
  const wait = Math.max(1000, Math.min(...pending.map((i) => i.nextAttemptAt)) - Date.now());
  timer = setTimeout(kick, wait);
}
