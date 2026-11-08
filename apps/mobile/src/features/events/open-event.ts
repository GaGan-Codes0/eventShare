import type { EventRole } from '@eventshare/shared';
import { router } from 'expo-router';

import { setCurrentEvent } from '@/store/current-event';
import { setGuestView } from '@/store/shell';

/** Where an event opens: the host runs it from Overview, everyone else lands on its Home. */
export function eventHome(role: EventRole) {
  return role === 'host' ? ('/(tabs)/overview' as const) : ('/(tabs)/home' as const);
}

/** Go into an event from Your events, a new event or a join. */
export function openEvent(id: string, role: EventRole) {
  setGuestView(false);
  setCurrentEvent(id);
  router.navigate(eventHome(role));
}

/** Host: see the event and shoot as guests do (no shot limit, no review for the host). */
export function openGuestView() {
  setGuestView(true);
  router.navigate('/(tabs)/home');
}

/** Host in guest view: back to running the event. */
export function backToDashboard() {
  setGuestView(false);
  router.navigate('/(tabs)/overview');
}

/** Out of the event, to the tab of My events / Join / Host you left from. */
export function backToMyEvents() {
  setGuestView(false);
  setCurrentEvent(null);
  router.dismissAll();
  router.replace('/events');
}
