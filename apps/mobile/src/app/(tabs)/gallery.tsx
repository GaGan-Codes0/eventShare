import { LoadingState } from '@/components/ui';
import { NoEventYet } from '@/features/events/no-event';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { AlbumView } from '@/features/gallery/album-view';

/** Host: every photo, the review queue and hidden ones. */
export default function Gallery() {
  const { id, event } = useCurrentEvent();
  if (!id) return <NoEventYet title="Gallery" />;
  if (!event) return <LoadingState />;
  return <AlbumView event={event} host />;
}
