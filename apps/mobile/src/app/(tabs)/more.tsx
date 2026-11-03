// import { useClerk } from '@clerk/expo'; // Clerk is switched off for now.
import { router } from 'expo-router';
import { Check, LogOut, Plus, QrCode, ScanLine } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Header, MenuGroup, MenuLabel, MenuRow, Pill, Text } from '@/components/ui';
import { colors, icon, radius, screenPadding, space } from '@/constants/theme';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { useEvents, useMe } from '@/services/api/hooks';
import { setSession } from '@/services/api/session';
import { setCurrentEvent } from '@/store/current-event';
import { formatEventDate, plural } from '@/utils/format';

export default function More() {
  const { id: currentId, event } = useCurrentEvent();
  const events = useEvents();
  const me = useMe();

  async function signOut() {
    setCurrentEvent(null);
    await setSession(null); // Clerk: await clerk.signOut(). Navigation happens in SessionWatch.
  }

  return (
    <View style={styles.screen}>
      <Header title="More" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.profile}>
          <Avatar name={me.data?.name ?? ''} uri={me.data?.avatarUrl} size={40} />
          <View style={styles.flex}>
            <Text variant="bodyStrong">Hello, {me.data?.name ?? 'there'}.</Text>
            <Text variant="caption" color="muted">
              {me.data?.email ?? ''}
            </Text>
          </View>
          {event && <Pill label={event.role === 'host' ? 'Host' : 'Guest'} />}
        </View>

        <MenuLabel>Your events</MenuLabel>
        <MenuGroup>
          {(events.data ?? []).map((e) => (
            <MenuRow
              key={e.id}
              title={e.name}
              caption={[formatEventDate(e.startsAt), plural(e.photoCount, 'photo'), e.role === 'host' ? 'Hosting' : null]
                .filter(Boolean)
                .join(' · ')}
              trailing={e.id === currentId ? <Check size={icon.sm} color={colors.primary} /> : undefined}
              onPress={() => {
                setCurrentEvent(e.id);
                router.navigate('/(tabs)');
              }}
            />
          ))}
        </MenuGroup>

        <MenuLabel>This event</MenuLabel>
        <MenuGroup>
          <MenuRow icon={QrCode} title="Invite people" caption="QR code, link and code" onPress={() => router.push('/invite')} />
        </MenuGroup>

        <MenuLabel>More events</MenuLabel>
        <MenuGroup>
          <MenuRow icon={ScanLine} title="Join an event" caption="With a code from your host" onPress={() => router.push('/join')} />
          <MenuRow icon={Plus} title="Create an event" caption="You'll be the host" onPress={() => router.push('/create-event')} />
        </MenuGroup>

        <MenuGroup>
          <MenuRow icon={LogOut} title="Sign out" onPress={signOut} />
        </MenuGroup>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: screenPadding, paddingBottom: space['4xl'] },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.sage,
  },
  flex: { flex: 1, gap: 2 },
});
