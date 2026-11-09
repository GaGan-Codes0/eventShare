import { router, useLocalSearchParams } from 'expo-router';
import { Aperture, CalendarClock, Grid3x3, LogOut } from 'lucide-react-native';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { initialsOf, Text } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { backToDashboard, backToMyEvents } from '@/features/events/open-event';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { setGuestView, setShellTab, useGuestView } from '@/store/shell';
import { useMe } from '@/services/api/hooks';
import { setSession } from '@/services/api/session';
import { setCurrentEvent } from '@/store/current-event';
import { setPreference, usePreferences } from '@/store/preferences';
import { defaultTheme, makeStyles, ThemeProvider, useCurrentEventTheme, useTheme } from '@/theme';

const ROLE_NAME = { host: 'Host', photographer: 'Designated photographer', member: 'Guest' } as const;

/**
 * You, as in the prototype: who you're signed in as; inside an event, your role there and your
 * roll, and Leave event; then Sign out.
 */
function Profile() {
  const { colors } = useTheme();
  const styles = useStyles();
  const me = useMe();
  const prefs = usePreferences();
  const { event } = useCurrentEvent();
  const guestView = useGuestView();
  // Opened from inside an event (?from=event), or from Your events.
  const fromEvent = useLocalSearchParams<{ from?: string }>().from === 'event';
  const name = me.data?.name ?? '';

  async function signOut() {
    setCurrentEvent(null);
    setGuestView(false);
    setShellTab('join');
    await setSession(null); // SessionWatch clears the data; the signed-in screens drop away.
  }

  // Out of the event to My events (you stay a member and can come back). A host looking at
  // their event as a guest goes back to running it instead.
  const hostGuestView = event?.role === 'host' && guestView;

  const used = event && (event.photoLimit === null ? `${event.photosUsed} shots taken` : `${event.photosUsed} of ${event.photoLimit} used`);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body} scrollEnabled={false}>
      <View style={styles.me}>
        <View style={styles.avatar}>
          {me.data?.avatarUrl ? (
            <Image source={{ uri: me.data.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <Text style={styles.avatarText}>{initialsOf(name)}</Text>
          )}
        </View>
        <View style={styles.flex}>
          <Text style={styles.name}>{name}</Text>
          <Text variant="caption" color="muted" numberOfLines={1}>
            {me.data?.email ?? ''} · Email
          </Text>
        </View>
      </View>

      {fromEvent && event && (
        <View style={styles.group}>
          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <Aperture size={18} color={colors.accent} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>
                {ROLE_NAME[event.role]} at {event.name}
              </Text>
              <Text variant="caption" color="muted">
                {used}
              </Text>
            </View>
          </View>
          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <Grid3x3 size={18} color={colors.accent} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>Camera grid</Text>
              <Text variant="caption" color="muted">
                Lines on the camera to help you frame a shot.
              </Text>
            </View>
            <Switch
              accessibilityLabel="Camera grid"
              value={prefs.cameraGrid}
              onValueChange={(on) => setPreference('cameraGrid', on)}
              trackColor={{ true: colors.primary, false: colors.lineStrong }}
              thumbColor={colors.surface}
              ios_backgroundColor={colors.lineStrong}
            />
          </View>
          {/* Your own choice: hide the host's date stamp on your phone (originals never have it). */}
          {event.dateStamp && (
            <View style={styles.card}>
              <View style={styles.cardIcon}>
                <CalendarClock size={18} color={colors.accent} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>Date stamp on photos</Text>
                <Text variant="caption" color="muted">
                  Only on your phone; originals never have it.
                </Text>
              </View>
              <Switch
                accessibilityLabel="Date stamp on photos"
                value={prefs.dateStamp}
                onValueChange={(on) => setPreference('dateStamp', on)}
                trackColor={{ true: colors.primary, false: colors.lineStrong }}
                thumbColor={colors.surface}
                ios_backgroundColor={colors.lineStrong}
              />
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              router.back();
              if (hostGuestView) backToDashboard();
              else backToMyEvents();
            }}
            style={({ pressed }) => [styles.leave, pressed && { opacity: 0.85 }]}>
            <LogOut size={17} color={colors.ink} />
            <Text style={styles.leaveText}>{hostGuestView ? 'Back to the dashboard' : 'Back to my events'}</Text>
          </Pressable>
        </View>
      )}

      <Pressable accessibilityRole="button" onPress={signOut} style={styles.signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
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

const useStyles = makeStyles(({ colors, fonts }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { paddingHorizontal: space.xl, paddingTop: space['2xl'], paddingBottom: space['3xl'], gap: space.lg },
  me: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, gap: 2 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  // The prototype's sheet: initials in DM Sans, the name semibold.
  avatarText: { fontFamily: fonts.sansSemiBold, fontSize: 15, lineHeight: 18, color: colors.ink },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 17, lineHeight: 22, color: colors.ink },
  group: { gap: space.sm + 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14.5, lineHeight: 19, color: colors.ink },
  leave: { height: 48, borderRadius: 14, backgroundColor: colors.sage, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  leaveText: { fontFamily: fonts.sansSemiBold, fontSize: 14.5, lineHeight: 18, color: colors.ink },
  signOut: { height: 44, alignItems: 'center', justifyContent: 'center' },
  signOutText: { fontFamily: fonts.sansSemiBold, fontSize: 14.5, lineHeight: 18, color: '#9F4C3E' },
}));
