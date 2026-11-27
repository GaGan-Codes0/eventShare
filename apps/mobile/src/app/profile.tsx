import { router, useLocalSearchParams } from 'expo-router';
import { Aperture, CalendarClock, Grid3x3, LogOut, Pencil, UserX } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { LegalLinks } from '@/components/legal-links';
import { initialsOf, Text } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { backToDashboard, backToMyEvents } from '@/features/events/open-event';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { setGuestView, setShellTab, useGuestView } from '@/store/shell';
import { useBlockedUsers, useMe, useSetBlocked } from '@/services/api/hooks';
import { discardUserItems } from '@/features/uploads/queue';
import { api } from '@/services/api/client';
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
  const [deleting, setDeleting] = useState(false);
  const blocked = useBlockedUsers().data ?? [];
  const setBlocked = useSetBlocked();
  /**
   * Each row here closes this sheet and then goes somewhere. A second quick tap would close what's
   * under the sheet too (or push a screen twice), so only the first tap counts.
   */
  const leaving = useRef(false);
  const once = (go: () => void) => () => {
    if (leaving.current) return;
    leaving.current = true;
    go();
  };

  async function signOut() {
    setCurrentEvent(null);
    setGuestView(false);
    setShellTab('join');
    await setSession(null); // SessionWatch clears the data; the signed-in screens drop away.
  }

  // Asked twice: it can't be undone, and a host's events go with the account.
  function confirmDelete() {
    Alert.alert(
      'Delete your account?',
      'This removes your account and the photos, videos and voice messages you added. Events you host are deleted for everyone. This can\'t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you sure?', 'Your account will be deleted right away.', [
              { text: 'Keep my account', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: deleteAccount },
            ]),
        },
      ],
    );
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await api('/me', { method: 'DELETE' });
      if (me.data) discardUserItems(me.data.id);
      await signOut();
    } catch (e) {
      setDeleting(false);
      Alert.alert('Could not delete your account', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  // Out of the event to My events (you stay a member and can come back). A host looking at
  // their event as a guest goes back to running it instead.
  const hostGuestView = event?.role === 'host' && guestView;

  const used = event && (event.photoLimit === null ? `${event.photosUsed} shots taken` : `${event.photosUsed} of ${event.photoLimit} used`);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body} scrollEnabled={blocked.length > 0}>
      {/* Tap to edit your name and email. A missing email (Apple's "Hide my email") invites adding one. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit profile"
        onPress={once(() => {
          router.back();
          router.push('/edit-profile');
        })}
        style={({ pressed }) => [styles.me, pressed && { opacity: 0.7 }]}>
        <View style={styles.avatar}>
          {me.data?.avatarUrl ? (
            <Image source={{ uri: me.data.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <Text style={styles.avatarText}>{initialsOf(name)}</Text>
          )}
        </View>
        <View style={styles.flex}>
          <Text style={styles.name}>{name}</Text>
          <Text variant="caption" color={me.data?.email ? 'muted' : 'accent'} numberOfLines={1}>
            {me.data?.email ?? 'Add your email'}
          </Text>
        </View>
        <View style={styles.edit}>
          <Pencil size={14} color={colors.ink} />
          <Text style={styles.editText}>Edit</Text>
        </View>
      </Pressable>

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
            onPress={once(() => {
              router.back();
              if (hostGuestView) backToDashboard();
              else backToMyEvents();
            })}
            style={({ pressed }) => [styles.leave, pressed && { opacity: 0.85 }]}>
            <LogOut size={17} color={colors.ink} />
            <Text style={styles.leaveText}>{hostGuestView ? 'Back to the dashboard' : 'Back to my events'}</Text>
          </Pressable>
        </View>
      )}

      {/* People you blocked from a photo. Their photos come back everywhere once unblocked. */}
      {blocked.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <UserX size={18} color={colors.accent} />
          </View>
          <View style={[styles.flex, styles.blockedList]}>
            <Text style={styles.cardTitle}>Blocked people</Text>
            {blocked.map((p) => (
              <View key={p.id} style={styles.blockedRow}>
                <Text variant="caption" color="muted" style={styles.flex} numberOfLines={1}>
                  {p.name}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Unblock ${p.name}`}
                  disabled={setBlocked.isPending}
                  onPress={() =>
                    setBlocked.mutate({ userId: p.id, blocked: false }, { onError: (e) => Alert.alert("Couldn't unblock", e.message) })
                  }
                  style={({ pressed }) => [styles.edit, pressed && { opacity: 0.7 }]}>
                  <Text style={styles.editText}>Unblock</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      )}

      <Pressable accessibilityRole="button" onPress={once(() => void signOut())} style={styles.signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={confirmDelete} disabled={deleting} style={styles.delete}>
        {deleting ? <ActivityIndicator color={colors.muted} /> : <Text style={styles.deleteText}>Delete account</Text>}
      </Pressable>
      <LegalLinks />
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
  edit: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 12, borderRadius: radius.full, backgroundColor: colors.sage },
  editText: { fontFamily: fonts.sansSemiBold, fontSize: 13, lineHeight: 16, color: colors.ink },
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
  blockedList: { gap: space.sm },
  blockedRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  leave: { height: 48, borderRadius: 14, backgroundColor: colors.sage, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  leaveText: { fontFamily: fonts.sansSemiBold, fontSize: 14.5, lineHeight: 18, color: colors.ink },
  signOut: { height: 44, alignItems: 'center', justifyContent: 'center' },
  signOutText: { fontFamily: fonts.sansSemiBold, fontSize: 14.5, lineHeight: 18, color: '#9F4C3E' },
  delete: { height: 36, alignItems: 'center', justifyContent: 'center', marginTop: -space.sm },
  deleteText: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 16, color: colors.muted },
}));
