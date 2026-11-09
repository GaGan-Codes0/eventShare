import type { EventDetail } from '@eventshare/shared';
import { Plus } from 'lucide-react-native';
import { Alert } from 'react-native';

import { toast } from '@/components/toast';
import { Button, Text, type ButtonProps } from '@/components/ui';
import { useRequestRefill } from '@/services/api/hooks';

/** A guest who has used their roll asks the hosts for more shots, and sees where that stands. */
export function RefillAction({ event, textStyle, variant }: { event: EventDetail; textStyle?: object; variant?: ButtonProps['variant'] }) {
  const request = useRequestRefill(event.id);
  if (event.refillStatus) {
    return (
      <Text variant="caption" align="center" color={textStyle ? undefined : 'muted'} style={textStyle}>
        {event.refillStatus === 'pending' ? 'Request sent. Your shots will appear here.' : 'The hosts can’t add more right now. You can ask again a little later.'}
      </Text>
    );
  }
  return (
    <Button
      label="Ask for more shots"
      variant={variant}
      leadingIcon={Plus}
      loading={request.isPending}
      onPress={() =>
        request.mutate(undefined, {
          onSuccess: () => toast('Request sent to the hosts'),
          onError: (e) => Alert.alert("Couldn't send that", e.message),
        })
      }
    />
  );
}
