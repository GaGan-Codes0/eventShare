import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

/** The event the tabs are showing. Persisted so the app reopens where you left off. */
const KEY = 'current-event';
let current: string | null = null;
const listeners = new Set<() => void>();

export async function loadCurrentEvent() {
  current = await SecureStore.getItemAsync(KEY);
}

export function setCurrentEvent(id: string | null) {
  current = id;
  listeners.forEach((l) => l());
  void (id ? SecureStore.setItemAsync(KEY, id) : SecureStore.deleteItemAsync(KEY));
}

export function useCurrentEventId() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => current,
  );
}
