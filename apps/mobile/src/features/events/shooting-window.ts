import { shootingPhase, shootingWindow, type EventRole, type ShootingPhase } from '@eventshare/shared';
import { useEffect, useState } from 'react';

const RECHECK_MS = 60 * 60_000;

/** Where this person stands with the camera, changing by itself the moment it opens or closes. */
export function useShootingPhase(event: { role: EventRole; startsAt: string | null } | null | undefined): ShootingPhase {
  // The time is state, not read while rendering: a render that reads the clock can be skipped as unchanged.
  const [now, setNow] = useState(() => Date.now());
  const role = event?.role;
  const startsAt = event?.startsAt ?? null;

  // The date itself can change while this screen is open.
  useEffect(() => {
    const timer = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(timer);
  }, [startsAt]);

  useEffect(() => {
    const window = shootingWindow(startsAt);
    if (!window) return;
    const current = Date.now();
    const next = [window.opensAt, window.closesAt].find((t) => t > current);
    if (next === undefined) return;
    // Long timers aren't reliable on phones, so far-off changes are looked at again each hour.
    const timer = setTimeout(() => setNow(Date.now()), Math.min(next - current + 50, RECHECK_MS));
    return () => clearTimeout(timer);
  }, [startsAt, now]);

  return role ? shootingPhase(role, startsAt, now) : 'open';
}
