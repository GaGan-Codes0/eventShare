import { LoadingState } from '@/components/ui';
import { NoEventYet } from '@/features/events/no-event';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { AlbumView } from '@/features/gallery/album-view';

/** Guests and photographers: the shared album. */
export default function Album() {
  const { id, event } = useCurrentEvent();
  if (!id) return <NoEventYet title="The album" />;
  if (!event) return <LoadingState />;
  return <AlbumView event={event} host={false} />;
}
