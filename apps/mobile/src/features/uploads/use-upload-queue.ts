import { useSyncExternalStore } from 'react';

import { getQueue, subscribeQueue } from './queue';

/** Live view of photos, videos and voice notes still on this phone waiting to upload. */
export function useUploadQueue(eventId?: string | null) {
  const items = useSyncExternalStore(subscribeQueue, getQueue);
  const scoped = eventId ? items.filter((i) => i.eventId === eventId) : items;
  // Waiting to reach the server, so not yet counted in the event's allowances.
  const waiting = scoped.filter((i) => !i.permanent && !i.reserved);
  const ms = (kind: 'video' | 'voice') => waiting.filter((i) => i.kind === kind).reduce((n, i) => n + (i.durationMs ?? 0), 0);
  return {
    items: scoped,
    pending: scoped.filter((i) => !i.permanent).length,
    failed: scoped.filter((i) => i.permanent),
    /** Photos not yet counted in photosUsed. */
    unreserved: waiting.filter((i) => (i.kind ?? 'photo') === 'photo').length,
    /** Video and voice time not yet counted in videoMsUsed / voiceMsUsed. */
    unreservedVideoMs: ms('video'),
    unreservedVoiceMs: ms('voice'),
  };
}
