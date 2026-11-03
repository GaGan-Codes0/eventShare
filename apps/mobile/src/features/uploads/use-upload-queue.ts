import { useSyncExternalStore } from 'react';

import { getQueue, subscribeQueue } from './queue';

/** Live view of photos still on this phone waiting to upload. */
export function useUploadQueue(eventId?: string | null) {
  const items = useSyncExternalStore(subscribeQueue, getQueue);
  const scoped = eventId ? items.filter((i) => i.eventId === eventId) : items;
  return {
    items: scoped,
    pending: scoped.filter((i) => !i.permanent).length,
    failed: scoped.filter((i) => i.permanent),
  };
}
