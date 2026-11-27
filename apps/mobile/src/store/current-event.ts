import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

/** The event the tabs are showing. Persisted so the app reopens where you left off. */
const KEY = 'current-event';
let current: string | null = null;
const listeners = new Set<() => void>();

export async function loadCurrentEvent() {
  try {
    current = await SecureStore.getItemAsync(KEY);
  } catch {
    // Unreadable (e.g. the keychain is locked): open on Your events instead of never opening.
    current = null;
  }
}

export function setCurrentEvent(id: string | null) {
  current = id;
  listeners.forEach((l) => l());
  void (id ? SecureStore.setItemAsync(KEY, id) : SecureStore.deleteItemAsync(KEY)).catch(() => undefined);
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
