import { useEvent } from '@/services/api/hooks';
import { useCurrentEventId } from '@/store/current-event';

/** The event the tabs are showing, with the signed-in user's role in it. */
export function useCurrentEvent() {
  const id = useCurrentEventId();
  const query = useEvent(id);
  return { id, event: query.data ?? null, isHost: query.data?.role === 'host', query };
}
