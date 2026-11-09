import type { EventDetail, EventLive, Page, Photo, PhotoListFilter } from '@eventshare/shared';
import { useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { api, API_URL } from '@/services/api/client';
import { keys } from '@/services/api/hooks';
import { getAuthHeaders } from '@/services/api/session';

/** How many of the newest photos a live refresh asks for. */
const NEWEST = 30;
/** Used only while the live connection is down. */
const FALLBACK_POLL_MS = 30_000;
/** The event's totals (photos, guests) are refreshed at most this often during a burst. */
const SUMMARY_EVERY_MS = 30_000;
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

/** Adds the newest photos to a loaded gallery and updates the ones it already has. Null if there's a gap. */
function mergeNewest(data: InfiniteData<Page<Photo>>, head: Page<Photo>): InfiniteData<Page<Photo>> | null {
  const fresh = new Map(head.items.map((p) => [p.id, p]));
  const known = new Set(data.pages.flatMap((page) => page.items.map((p) => p.id)));
  // So many arrived that none of these touch what's loaded: there are photos in between.
  if (known.size > 0 && head.nextCursor && !head.items.some((p) => known.has(p.id))) return null;
  const added = head.items.filter((p) => !known.has(p.id));
  const pages = data.pages.map((page, i) => {
    const items = page.items.map((p) => fresh.get(p.id) ?? p);
    if (i !== 0) return { ...page, items };
    return { ...page, items: [...added, ...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
  });
  return { ...data, pages };
}

/** Fetches only the newest photos for each gallery on screen, instead of every page again. */
export async function refreshNewest(qc: QueryClient, eventId: string) {
  const open = qc.getQueryCache().findAll({ queryKey: keys.photos(eventId), type: 'active' });
  await Promise.all(
    open.map(async (query) => {
      const filter = query.queryKey[3] as PhotoListFilter;
      const head = await api<Page<Photo>>(`/events/${eventId}/photos?filter=${filter}&limit=${NEWEST}`);
      const data = qc.getQueryData<InfiniteData<Page<Photo>>>(query.queryKey);
      if (!data) return;
      const merged = mergeNewest(data, head);
      if (merged) qc.setQueryData(query.queryKey, merged);
      else void qc.invalidateQueries({ queryKey: query.queryKey, exact: true });
    }),
  );
}

/**
 * Keeps the open event up to date: the server pushes when something changes, and this fetches
 * only what's new. Phones spread their fetches over a window that grows with the event, so a
 * thousand guests don't all ask at the same instant. Falls back to a light check if the
 * connection drops, and keeps going while the app is in the background.
 */
export function useLiveEvent(eventId: string | null, memberCount: number) {
  const qc = useQueryClient();
  const members = useRef(memberCount);
  useEffect(() => {
    members.current = memberCount;
  }, [memberCount]);

  useEffect(() => {
    if (!eventId) return;
    let stopped = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let last: EventLive | null = null;
    let dirtyNew = false;
    let dirtyRev = false;
    let dirtyRefill = false;
    let summaryAt = 0;

    const flush = () => {
      flushTimer = null;
      if (dirtyRefill) {
        void qc.invalidateQueries({ queryKey: keys.refills(eventId) });
        void qc.invalidateQueries({ queryKey: keys.members(eventId) });
        void qc.invalidateQueries({ queryKey: keys.event(eventId), exact: true });
        dirtyRefill = false;
      }
      if (dirtyRev) {
        // Something other than a new photo: a hide, delete, approval or rule change.
        void qc.invalidateQueries({ queryKey: keys.event(eventId) });
      } else if (dirtyNew) {
        refreshNewest(qc, eventId).catch(() => undefined);
        if (Date.now() - summaryAt > SUMMARY_EVERY_MS) {
          summaryAt = Date.now();
          void qc.invalidateQueries({ queryKey: keys.event(eventId), exact: true });
        }
      }
      dirtyNew = dirtyRev = false;
    };

    const onLive = (live: EventLive) => {
      const before = last;
      last = live;
      if (!before) return; // The first reading after opening: what's on screen is already current.
      dirtyNew ||= live.new !== before.new;
      dirtyRev ||= live.rev !== before.rev;
      // Refills only matter to the hosts and to whoever is waiting; for them, no spreading out.
      const current = qc.getQueryData<EventDetail>(keys.event(eventId));
      if (live.refill !== before.refill && (current?.role === 'host' || current?.refillStatus === 'pending')) {
        dirtyRefill = true;
        if (flushTimer) clearTimeout(flushTimer);
        flushTimer = setTimeout(flush, 200);
        return;
      }
      if ((dirtyNew || dirtyRev) && !flushTimer) {
        const spread = Math.min(15_000, Math.max(500, members.current * 10));
        flushTimer = setTimeout(flush, Math.random() * spread);
      }
    };

    const connect = async () => {
      const header = (await getAuthHeaders()).Authorization;
      if (stopped || !header) return;
      const ws = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/realtime`);
      socket = ws;
      ws.onopen = () => {
        attempts = 0;
        ws.send(JSON.stringify({ t: 'auth', token: header.replace(/^Bearer /, '') }));
        ws.send(JSON.stringify({ t: 'watch', eventId }));
      };
      ws.onmessage = (e) => {
        const message = JSON.parse(String(e.data)) as { t: string; eventId: string; live: EventLive };
        if (message.t === 'live' && message.eventId === eventId) onLive(message.live);
      };
      ws.onclose = (e) => {
        socket = null;
        // Signed out or no longer in this event: trying again won't help.
        if (stopped || e.code === 4401 || e.code === 4403) return;
        attempts += 1;
        const wait = Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** attempts);
        reconnectTimer = setTimeout(() => void connect(), wait * (0.5 + Math.random() / 2));
      };
    };
    void connect();

    const poll = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) return;
      api<EventLive>(`/events/${eventId}/live`).then(onLive, () => undefined);
    }, FALLBACK_POLL_MS);

    return () => {
      stopped = true;
      clearInterval(poll);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (flushTimer) clearTimeout(flushTimer);
      socket?.close();
    };
  }, [eventId, qc]);
}
