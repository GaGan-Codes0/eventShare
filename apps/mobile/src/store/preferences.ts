import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

/** Small choices each person makes on their own phone, remembered between launches. */
export type Preferences = {
  /** What Save puts in the phone's library: the untouched original, a framed copy, or both. */
  saveOriginal: boolean;
  saveFramed: boolean;
  /** A copy inside the host's own frame (when the host has uploaded one). */
  saveHostFrame: boolean;
  /** A full-quality copy with the event's photo look (when it has one). */
  saveFiltered: boolean;
  /** Show the event's date stamp on photos (when the host has it on). */
  dateStamp: boolean;
  /** Rule-of-thirds lines on the viewfinder. */
  cameraGrid: boolean;
};

const KEY = 'preferences';
const DEFAULTS: Preferences = { saveOriginal: true, saveFramed: false, saveHostFrame: true, saveFiltered: true, dateStamp: true, cameraGrid: false };
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
