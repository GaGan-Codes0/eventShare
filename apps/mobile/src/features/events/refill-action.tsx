import { refillShotsFor, type EventDetail } from '@eventshare/shared';
import { Plus } from 'lucide-react-native';
import { Alert, View } from 'react-native';

import { toast } from '@/components/toast';
import { Button, Text, type ButtonProps } from '@/components/ui';
import { useRequestRefill } from '@/services/api/hooks';

/**
 * A guest who has used their roll asks the hosts for a top-up, and sees where that stands.
 * A top-up is always half the event's shots per guest; the hosts allow or reject it.
 */
export function RefillAction({ event, textStyle, variant }: { event: EventDetail; textStyle?: object; variant?: ButtonProps['variant'] }) {
  const request = useRequestRefill(event.id);
  const base = event.guestPhotoLimit;
  if (base === null) return null; // No shot limit, nothing to top up.
  const shots = refillShotsFor(base);
  const color = textStyle ? undefined : 'muted';

  if (event.refillStatus) {
    return (
      <Text variant="caption" align="center" color={color} style={textStyle}>
        {event.refillStatus === 'pending'
          ? `Asked for ${shots} more shots. They’ll appear here once the host allows it.`
          : 'The host can’t add more right now. You can ask again a little later.'}
      </Text>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <Button
        label={`Ask for ${shots} more shots`}
        variant={variant}
        leadingIcon={Plus}
        loading={request.isPending}
        onPress={() =>
          request.mutate(undefined, {
            onSuccess: () => toast('Request sent to the host'),
            onError: (e) => Alert.alert("Couldn't send that", e.message),
          })
        }
      />
      <Text variant="caption" align="center" color={color} style={textStyle}>
        A top-up adds half of your {base} shots: up to {shots} more, if the host allows it.
      </Text>
    </View>
  );
}
