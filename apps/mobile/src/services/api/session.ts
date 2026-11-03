// Clerk is switched off for now (own email + password login instead).
// import { getClerkInstance } from '@clerk/expo';
import type { AuthSession, User } from '@eventshare/shared';
import * as SecureStore from 'expo-secure-store';

/**
 * The signed-in session: our API's login token, kept in the iOS Keychain / Android Keystore
 * (SecureStore). Lives outside React so the API client and the upload queue can use it too.
 */
const KEY = 'session';
let session: AuthSession | null = null;
const listeners = new Set<() => void>();

export async function loadSession() {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    session = raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    session = null;
  }
}

export function getSessionUser(): User | null {
  return session?.user ?? null;
}

export async function setSession(next: AuthSession | null) {
  session = next;
  if (next) await SecureStore.setItemAsync(KEY, JSON.stringify(next));
  else await SecureStore.deleteItemAsync(KEY);
  listeners.forEach((l) => l());
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  // Clerk: const token = await getClerkInstance().session?.getToken();
  const token = session?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
