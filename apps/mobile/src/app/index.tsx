import { Redirect } from 'expo-router';
import { CloudOff } from 'lucide-react-native';
import { useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';

import { Button, EmptyState, LoadingState } from '@/components/ui';
import { useEvents } from '@/services/api/hooks';
import { getSessionUser, subscribeSession } from '@/services/api/session';
import { takePendingJoin } from '@/store/pending-join';

/** Decides where the app opens: sign in, or Your events. */
export default function Gate() {
  const user = useSyncExternalStore(subscribeSession, getSessionUser);
  if (!user) return <Redirect href="/sign-in" />;
  return <EventGate />;
}

function EventGate() {
  // An invite link opened before signing in goes straight to that invite.
  const [pendingCode] = useState(takePendingJoin);
  const events = useEvents();
  if (pendingCode) return <Redirect href={{ pathname: '/join-preview', params: { code: pendingCode } }} />;
  if (events.isPending) return <LoadingState />;
  if (events.isError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState
          icon={CloudOff}
          title="Can't connect"
          message={events.error.message}
          action={<Button label="Try again" variant="secondary" onPress={() => events.refetch()} />}
        />
      </View>
    );
  }
  return <Redirect href="/events" />;
}
