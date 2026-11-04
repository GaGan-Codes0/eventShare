// import { useAuth } from '@clerk/expo'; // Clerk is switched off for now.
import { Redirect } from 'expo-router';
import { CloudOff } from 'lucide-react-native';
import { useEffect, useSyncExternalStore } from 'react';
import { View } from 'react-native';

import { Button, EmptyState, LoadingState } from '@/components/ui';
import { useEvents } from '@/services/api/hooks';
import { getSessionUser, subscribeSession } from '@/services/api/session';
import { setCurrentEvent, useCurrentEventId } from '@/store/current-event';

/** Decides where the app opens: sign in, or Home with your events. */
export default function Gate() {
  // Clerk: const { isLoaded, isSignedIn } = useAuth();
  const user = useSyncExternalStore(subscribeSession, getSessionUser);
  if (!user) return <Redirect href="/sign-in" />;
  return <EventGate />;
}

function EventGate() {
  const currentId = useCurrentEventId();
  const events = useEvents();
  const list = events.data;
  const currentIsValid = Boolean(currentId && list?.some((e) => e.id === currentId));

  // The camera, album and people tabs show one event: your last one, else your most recent.
  useEffect(() => {
    if (list && !currentIsValid) setCurrentEvent(list[0]?.id ?? null);
  }, [list, currentIsValid]);

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
  if (events.data.length > 0 && !currentIsValid) return <LoadingState />;
  return <Redirect href="/(tabs)" />;
}
