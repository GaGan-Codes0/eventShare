import { useSyncExternalStore } from 'react';

/**
 * Outside an event, the app is three tabs: Join (where it opens, since most people are guests),
 * My events, and Host. Kept here so leaving an event comes back to the tab you left from.
 */
export type ShellTab = 'join' | 'events' | 'host';

let tab: ShellTab = 'join';
/** The host is looking at their own event as a guest would (Home / Camera / Album). */
let guestView = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function setShellTab(next: ShellTab) {
  tab = next;
  emit();
}

export function useShellTab() {
  return useSyncExternalStore(subscribe, () => tab);
}

export function setGuestView(on: boolean) {
  guestView = on;
  emit();
}

export function useGuestView() {
  return useSyncExternalStore(subscribe, () => guestView);
}
