import { router } from 'expo-router';
import { CalendarPlus, Plus, ScanLine } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Button, EmptyState, Header } from '@/components/ui';
import { space } from '@/constants/theme';
import { setShellTab } from '@/store/shell';

/** Shown on the event tabs before you've joined or created any event. */
export function NoEventYet({ title }: { title: string }) {
  return (
    <View style={styles.screen}>
      <Header title={title} />
      <View style={styles.body}>
        <EmptyState
          icon={CalendarPlus}
          title="No event yet"
          message="Join an event with a code from your host, or create your own."
          action={
            <View style={styles.actions}>
              <Button label="Join an event" leadingIcon={ScanLine} fullWidth onPress={() => {
                  setShellTab('join');
                  router.navigate('/events');
                }} />
              <Button label="Create an event" leadingIcon={Plus} variant="secondary" fullWidth onPress={() => router.push('/create-event')} />
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, justifyContent: 'center' },
  actions: { gap: space.md, alignSelf: 'stretch' },
});
