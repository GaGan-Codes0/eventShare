/**
 * Puts faceprints on the server: for each photo this phone uploads, and (on the host's phone) for
 * older photos nobody has looked at yet. One photo at a time, so it never competes with the camera.
 */
import { FACE_MODEL, type EventDetail, type PendingFaceScan, type SaveFacesInput } from '@eventshare/shared';
import type { QueryClient } from '@tanstack/react-query';

import { api } from '@/services/api/client';
import { keys } from '@/services/api/hooks';

import { findFaces } from './detect';

let chain: Promise<unknown> = Promise.resolve();

/** Runs jobs one after another, never two at once. */
function inTurn<T>(job: () => Promise<T>): Promise<T> {
  const next = chain.then(job, job);
  chain = next.catch(() => undefined);
  return next;
}

/** Finds the faces in one photo and sends them. Failures are left for the host's phone to retry. */
export function scanPhoto(photoId: string, uri: string) {
  return inTurn(async () => {
    const faces = await findFaces(uri);
    const body: SaveFacesInput = { model: FACE_MODEL, faces: faces.map((f) => ({ box: f.box, embedding: f.embedding })) };
    await api(`/photos/${photoId}/faces`, { method: 'PUT', body });
    return faces.length;
  });
}

/** True while the event (as last loaded) has Find my photos on. Unknown events count as on. */
export function scanningOn(qc: QueryClient, eventId: string) {
  return qc.getQueryData<EventDetail>(keys.event(eventId))?.findMyPhotos ?? true;
}

const backfilling = new Set<string>();

/**
 * Host: works through the event's older photos, 20 at a time, until none are left. A photo that
 * can't be read is skipped this time round (and offered again next time the Gallery opens).
 */
export async function backfill(eventId: string, onProgress?: (done: number) => void) {
  if (backfilling.has(eventId)) return;
  backfilling.add(eventId);
  const skipped = new Set<string>();
  let done = 0;
  try {
    for (;;) {
      const batch = (await api<PendingFaceScan[]>(`/events/${eventId}/faces/pending`)).filter((p) => !skipped.has(p.id));
      if (batch.length === 0) break;
      for (const p of batch) {
        try {
          await scanPhoto(p.id, p.url);
          done += 1;
          onProgress?.(done);
        } catch {
          skipped.add(p.id);
        }
      }
    }
  } finally {
    backfilling.delete(eventId);
  }
}
