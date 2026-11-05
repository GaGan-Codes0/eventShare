import { router, useLocalSearchParams } from 'expo-router';
import { Aperture, LogOut, QrCode, UserRound } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { Avatar, Button, Text } from '@/components/ui';
import { icon, radius, screenPadding, space } from '@/constants/theme';
import { ROLE_LABEL } from '@/features/events/roles';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { useMe } from '@/services/api/hooks';
import { setSession } from '@/services/api/session';
import { setCurrentEvent } from '@/store/current-event';
import { defaultTheme, makeStyles, ThemeProvider, useCurrentEventTheme, useTheme } from '@/theme';

/** You: your role and photos in the open event, back to your events, invite, sign out. */
function Profile() {
  const { colors } = useTheme();
  const styles = useStyles();
  const me = useMe();
  const { event } = useCurrentEvent();
  // Opened from inside an event (?from=event), or from Your events.
  const fromEvent = useLocalSearchParams<{ from?: string }>().from === 'event';

  async function signOut() {
    setCurrentEvent(null);
    await setSession(null); // Navigation happens in SessionWatch.
  }

  const used =
    event && (event.photoLimit === null ? `${event.photosUsed} shots taken` : `${event.photosUsed} of ${event.photoLimit} used`);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <View style={styles.me}>
        <Avatar name={me.data?.name ?? ''} uri={me.data?.avatarUrl} size={40} />
        <View style={styles.flex}>
          <Text variant="title">{me.data?.name ?? ''}</Text>
          <Text variant="caption" color="muted">
            {me.data?.email ?? ''}
          </Text>
        </View>
      </View>

      {fromEvent && event && (
        <View style={styles.group}>
          <View style={styles.card}>
            <View style={styles.cardIcon}>
              {event.role === 'photographer' ? <Aperture size={18} color={colors.primaryText} /> : <UserRound size={18} color={colors.primaryText} />}
            </View>
            <View style={styles.flex}>
              <Text variant="bodyStrong">
                {event.role === 'photographer' ? 'Designated photographer' : ROLE_LABEL[event.role]} at {event.name}
              </Text>
              <Text variant="caption" color="muted">
                {used}
              </Text>
            </View>
          </View>
          <Button label="Invite people" leadingIcon={QrCode} variant="secondary" fullWidth onPress={() => router.replace('/invite')} />
          <Button
            label="Your events"
            leadingIcon={LogOut}
            variant="secondary"
            fullWidth
            onPress={() => {
              router.back();
              router.navigate('/events');
            }}
          />
        </View>
      )}

      <Pressable accessibilityRole="button" onPress={signOut} style={styles.signOut}>
        <LogOut size={icon.sm} color={colors.danger} />
        <Text variant="bodyStrong" color="danger">
          Sign out
        </Text>
      </Pressable>
    </ScrollView>
  );
}

/** In the open event's theme when opened from an event. */
export default function ProfileScreen() {
  const eventTheme = useCurrentEventTheme();
  const fromEvent = useLocalSearchParams<{ from?: string }>().from === 'event';
  return (
    <ThemeProvider theme={fromEvent ? eventTheme : defaultTheme}>
      <Profile />
    </ThemeProvider>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { padding: screenPadding, paddingTop: space['2xl'], gap: space.lg },
  me: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, gap: 2 },
  group: { gap: space.sm + 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: 14,
    borderRadius: radius.lg + 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  signOut: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
}));
