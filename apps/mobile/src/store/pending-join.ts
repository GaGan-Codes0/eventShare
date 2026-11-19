/**
 * An invite link opened while signed out (klickers.app/j/…). Kept in memory until sign in, so
 * the guest lands on the invite instead of having to scan or type the code again.
 */
let pending: string | null = null;

export function setPendingJoin(code: string) {
  pending = code;
}

/** The waiting code, once: reading it clears it. */
export function takePendingJoin(): string | null {
  const code = pending;
  pending = null;
  return code;
}
