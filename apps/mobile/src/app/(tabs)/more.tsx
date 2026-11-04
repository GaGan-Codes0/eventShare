// import { useClerk } from '@clerk/expo'; // Clerk is switched off for now.
import { router } from 'expo-router';
import { Check, LogOut, Palette, Plus, QrCode, ScanLine } from 'lucide-react-native';
import { Alert, ScrollView, View } from 'react-native';
import { GUEST_PHOTO_LIMITS, PHOTOGRAPHER_PHOTO_LIMIT } from '@eventshare/shared';

import { Avatar, Header, MenuGroup, MenuLabel, MenuRow, Pill, Segmented, Text } from '@/components/ui';
import { icon, radius, screenPadding, space } from '@/constants/theme';
import { makeStyles, PRESETS, useTheme } from '@/theme';
import { ROLE_LABEL } from '@/features/events/roles';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { useEvents, useMe, useUpdateEvent } from '@/services/api/hooks';
import { setSession } from '@/services/api/session';
import { setCurrentEvent } from '@/store/current-event';
import { formatEventDate, plural } from '@/utils/format';

export default function More() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { id: currentId, event, isHost } = useCurrentEvent();
  const update = useUpdateEvent(currentId ?? '');
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
          {event && <Pill label={ROLE_LABEL[event.role]} />}
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
                router.navigate('/(tabs)/album');
              }}
            />
          ))}
        </MenuGroup>

        {event && (
          <>
            <MenuLabel>This event</MenuLabel>
            <MenuGroup>
              <MenuRow icon={QrCode} title="Invite people" caption="QR code, link and code" onPress={() => router.push('/invite')} />
              {isHost && (
                <MenuRow
                  icon={Palette}
                  title="Event theme"
                  caption={event.theme ? (event.theme.color ? 'Your colour' : PRESETS[event.theme.preset].name) : 'eventShare’s look'}
                  onPress={() => router.push('/event-theme')}
                />
              )}
            </MenuGroup>
          </>
        )}
        {isHost && event && (
          <View style={styles.setting}>
            <Text variant="bodyStrong">Photos per guest</Text>
            <Segmented
              accessibilityLabel="Photos per guest"
              options={GUEST_PHOTO_LIMITS.map((n) => ({ value: n, label: String(n) }))}
              value={event.guestPhotoLimit}
              disabled={update.isPending}
              onChange={(guestPhotoLimit) =>
                update.mutate({ guestPhotoLimit }, { onError: (e) => Alert.alert("Couldn't change the limit", e.message) })
              }
            />
            <Text variant="caption" color="muted">
              Applies to every guest, including people already in. Photographers get {PHOTOGRAPHER_PHOTO_LIMIT}.
            </Text>
          </View>
        )}

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

const useStyles = makeStyles(({ colors }) => ({
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
  setting: { gap: space.sm, padding: space.lg, marginTop: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
}));
