import { useEvent } from '@/services/api/hooks';
import { useCurrentEventId } from '@/store/current-event';
import { useGuestView } from '@/store/shell';

/**
 * The event the tabs are showing, with the signed-in user's role in it. `managing` is the host
 * running it (their own tabs); a host who opened guest view sees what guests see instead.
 */
export function useCurrentEvent() {
  const id = useCurrentEventId();
  const query = useEvent(id);
  const guestView = useGuestView();
  const isHost = query.data?.role === 'host';
  return { id, event: query.data ?? null, isHost, managing: isHost && !guestView, query };
}
