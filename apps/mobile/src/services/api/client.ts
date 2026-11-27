import type { ApiError, ApiErrorCode } from '@eventshare/shared';

import { getAuthHeaders, setSession } from './session';

import { SITE_URL } from '@/constants/links';

/**
 * Set EXPO_PUBLIC_API_URL at build time (devices, test servers). Without it, development builds
 * use the Mac's localhost (the simulator reaches it directly) and release builds the live API on
 * our own domain, over HTTPS: a release can never ship pointing at localhost.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? 'http://localhost:4000' : SITE_URL);

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: ApiErrorCode,
  ) {
    super(message);
  }
}

/** True for failures worth retrying later (offline, timeouts, server hiccups) — not for 4xx. */
export function isRetryable(err: unknown) {
  return !(err instanceof ApiRequestError) || err.status >= 500 || err.status === 429;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const auth = await getAuthHeaders();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : null),
        ...auth,
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new Error("Can't reach Klickers. Check your connection.");
  }
  // Our token expired or was revoked: sign out, and the gate sends you to the sign-in screen.
  if (res.status === 401 && 'Authorization' in auth) void setSession(null);
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as (T & Partial<ApiError>) | null;
  if (!res.ok) throw new ApiRequestError(res.status, data?.message ?? 'Something went wrong', data?.code);
  return data as T;
}
