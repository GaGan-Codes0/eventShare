import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

/** Small choices each person makes on their own phone, remembered between launches. */
export type Preferences = {
  /** Show the event's frame on the live viewfinder. Photos are never framed. */
  viewfinderFrame: boolean;
  /** What Save puts in the phone's library: the untouched original, a framed copy, or both. */
  saveOriginal: boolean;
  saveFramed: boolean;
};

const KEY = 'preferences';
const DEFAULTS: Preferences = { viewfinderFrame: false, saveOriginal: true, saveFramed: false };
let prefs = DEFAULTS;
const listeners = new Set<() => void>();

export async function loadPreferences() {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (raw) prefs = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    // Unreadable: keep the defaults.
  }
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
  prefs = { ...prefs, [key]: value };
  listeners.forEach((l) => l());
  void SecureStore.setItemAsync(KEY, JSON.stringify(prefs));
}

export function usePreferences() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => prefs,
  );
}
