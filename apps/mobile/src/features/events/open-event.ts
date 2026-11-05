import type { EventRole } from '@eventshare/shared';
import { router } from 'expo-router';

import { setCurrentEvent } from '@/store/current-event';

/** Where an event opens: the host runs it from Overview, everyone else lands on its Home. */
export function eventHome(role: EventRole) {
  return role === 'host' ? ('/(tabs)/overview' as const) : ('/(tabs)/home' as const);
}

/** Go into an event from Your events, a new event or a join. */
export function openEvent(id: string, role: EventRole) {
  setCurrentEvent(id);
  router.navigate(eventHome(role));
}
