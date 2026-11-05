import type { EventIdentity, EventType } from '@eventshare/shared';

export const TYPE_LABEL: Record<EventType, string> = {
  wedding: 'Wedding',
  corporate: 'Corporate',
  birthday: 'Birthday',
  other: 'Event',
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts.length ? parts[0].slice(0, 2).toUpperCase() : '?';
}

type Named = Pick<EventIdentity, 'name' | 'type' | 'partner1' | 'partner2' | 'joiner' | 'organizer'>;

/** "T&P" for a wedding, else the name's initials. Stands in for a logo. */
export function monogram(e: Named) {
  if (e.type === 'wedding' && e.partner1 && e.partner2) {
    return `${e.partner1[0]}${e.joiner === 'and' ? '&' : e.joiner}${e.partner2[0]}`.toUpperCase();
  }
  return initials(e.name);
}

/** Who's hosting, for "Shot list from …" and the welcome line: the couple, the organizer, or the event. */
export function hostShort(e: Named) {
  if (e.type === 'wedding' && e.partner1 && e.partner2) return `${e.partner1} & ${e.partner2}`;
  return e.organizer || e.name;
}

const toDate = (iso: string | null) => (iso ? new Date(iso) : null);

/** "Wednesday, 4 November 2026". */
export function longDate(iso: string | null) {
  return toDate(iso)?.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) ?? '';
}

/** "4 Nov". */
export function shortDate(iso: string | null) {
  return toDate(iso)?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) ?? '';
}

/** The disposable-camera stamp on photos: "T&P · 04.11.26". */
export function stampText(e: Named, iso: string | null) {
  const d = toDate(iso) ?? new Date();
  const date = [d.getDate(), d.getMonth() + 1, d.getFullYear() % 100].map((n) => String(n).padStart(2, '0')).join('.');
  return `${monogram(e)} · ${date}`;
}
