import { MAX_PHOTOGRAPHERS, PHOTOGRAPHER_PHOTO_LIMIT, type EventDetail, type Member } from '@eventshare/shared';
import { router } from 'expo-router';
import { Aperture, MoreHorizontal, Plus, Trash2, UserPlus } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toast } from '@/components/toast';
import { initialsOf, LoadingState, Text } from '@/components/ui';
import { radius, screenPadding, space } from '@/constants/theme';
import { HostHeader } from '@/features/events/event-header';
import { NoEventYet } from '@/features/events/no-event';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { useMe, useMembers, useRemoveMember, useSetMemberRole } from '@/services/api/hooks';
import { makeStyles, useTheme } from '@/theme';

/** Host: the designated photographers (up to 3) and every guest with their shots used. */
export default function People() {
  const { id, event } = useCurrentEvent();
  if (!id) return <NoEventYet title="People" />;
  if (!event) return <LoadingState />;
  return <PeopleBody event={event} />;
}

function PeopleBody({ event }: { event: EventDetail }) {
  const { colors, fonts } = useTheme();
  const styles = useStyles();
  const me = useMe();
  const members = useMembers(event.id);
  const remove = useRemoveMember(event.id);
  const setRole = useSetMemberRole(event.id);
  const [picking, setPicking] = useState(false);
  const [menuFor, setMenuFor] = useState<Member | null>(null);

  const list = members.data ?? [];
  const shooters = list.filter((m) => m.role === 'photographer');
  const guests = list.filter((m) => m.role === 'member');
  const full = shooters.length >= MAX_PHOTOGRAPHERS;
  const limit = event.guestPhotoLimit;

  function promote(m: Member) {
    if (full) return toast(`All ${MAX_PHOTOGRAPHERS} photographer slots are taken`);
    setRole.mutate(
      { userId: m.userId, role: 'photographer' },
      {
        onSuccess: () => {
          setPicking(false);
          setMenuFor(null);
          toast(`${m.name.split(' ')[0]} is now a designated photographer`);
        },
        onError: (e) => Alert.alert("Couldn't change their role", e.message),
      },
    );
  }

  function demote(m: Member) {
    Alert.alert(`Make ${m.name} a guest again?`, `They go back to the guest roll. Photos they already took stay.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Make guest',
        onPress: () =>
          setRole.mutate(
            { userId: m.userId, role: 'member' },
            {
              onSuccess: () => toast(`${m.name.split(' ')[0]} is no longer a photographer`),
              onError: (e) => Alert.alert("Couldn't change their role", e.message),
            },
          ),
      },
    ]);
  }

  function confirmRemove(m: Member) {
    setMenuFor(null);
    Alert.alert(`Remove ${m.name}?`, "They'll lose access to the album and can't rejoin with the code.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          remove.mutate(m.userId, {
            onSuccess: () => {
              void members.refetch();
              toast(`${m.name.split(' ')[0]} removed from the event`);
            },
            onError: (e) => Alert.alert("Couldn't remove", e.message),
          }),
      },
    ]);
  }

  const used = (m: Member) => (limit === null ? `${m.photosUsed} shots` : `${m.photosUsed} of ${limit} shots`);
  const isMe = (m: Member) => m.userId === me.data?.id;

  return (
    <View style={styles.screen}>
      <HostHeader event={event} title="People" />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={members.isRefetching} onRefresh={() => void members.refetch()} />}>
        <Text variant="eyebrow">
          Designated photographers · {shooters.length}/{MAX_PHOTOGRAPHERS}
        </Text>
        <Text variant="caption" color="muted">
          Up to {MAX_PHOTOGRAPHERS} people, {PHOTOGRAPHER_PHOTO_LIMIT.toLocaleString('en-US')} uploads each. Their photos skip review, go live
          instantly and carry a Photographer badge.
        </Text>

        {shooters.map((p) => (
          <View key={p.userId} style={styles.card}>
            <View style={styles.cardTop}>
              <Initials name={p.name} badge />
              <View style={styles.flex}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {p.name}
                  {isMe(p) ? ' (you)' : ''}
                </Text>
                <Text variant="caption" color="muted">
                  Joined {new Date(p.joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
              <View style={styles.statusPill}>
                <Text variant="caption" style={{ color: colors.primary }}>
                  Shooting
                </Text>
              </View>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.min(100, (p.photosUsed / PHOTOGRAPHER_PHOTO_LIMIT) * 100)}%` }]} />
            </View>
            <View style={styles.cardFoot}>
              <Text variant="caption" color="muted" style={{ fontFamily: fonts.mono }}>
                {p.photosUsed} / {PHOTOGRAPHER_PHOTO_LIMIT.toLocaleString('en-US')} uploads
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${p.name} as photographer`} hitSlop={8} onPress={() => demote(p)}>
                <Text variant="label" color="danger">
                  Remove
                </Text>
              </Pressable>
            </View>
          </View>
        ))}

        {Array.from({ length: Math.max(0, MAX_PHOTOGRAPHERS - shooters.length) }, (_, i) => (
          <Pressable key={i} accessibilityRole="button" onPress={() => setPicking(true)} style={({ pressed }) => [styles.slot, pressed && { backgroundColor: colors.field }]}>
            <View style={styles.slotIcon}>
              <Plus size={19} color={colors.ink} />
            </View>
            <View style={styles.flex}>
              <Text variant="bodyStrong">Add photographer {shooters.length + i + 1}</Text>
              <Text variant="caption" color="muted">
                Pick someone who’s here
              </Text>
            </View>
          </Pressable>
        ))}

        <View style={styles.guestHead}>
          <Text variant="eyebrow">Guests · {guests.length}</Text>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/invite')} style={styles.row}>
            <UserPlus size={15} color={colors.primary} />
            <Text variant="label" style={{ color: colors.primary }}>
              Invite
            </Text>
          </Pressable>
        </View>
        {members.isPending ? (
          <LoadingState />
        ) : guests.length === 0 ? (
          <Text variant="caption" color="muted">
            No guests yet. Share the QR or code to get people in.
          </Text>
        ) : (
          guests.map((g) => (
            <View key={g.userId} style={styles.guest}>
              <Initials name={g.name} />
              <View style={[styles.flex, styles.guestText]}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {g.name}
                </Text>
                <View style={styles.row}>
                  <View style={styles.miniTrack}>
                    <View style={[styles.miniFill, { width: limit ? `${Math.min(100, (g.photosUsed / limit) * 100)}%` : '0%' }]} />
                  </View>
                  <Text variant="caption" color="muted">
                    {used(g)}
                  </Text>
                </View>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Options for ${g.name}`} hitSlop={6} onPress={() => setMenuFor(g)} style={styles.more}>
                <MoreHorizontal size={20} color={colors.muted} />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      <Sheet visible={picking} onClose={() => setPicking(false)}>
        <Text variant="eyebrow">Designated photographer</Text>
        <Text variant="h2">
          Who’s <Text variant="h2" emphasis>shooting?</Text>
        </Text>
        <Text variant="caption" color="muted">
          They get {PHOTOGRAPHER_PHOTO_LIMIT.toLocaleString('en-US')} uploads, a Photographer badge on every shot, and their photos skip review.
        </Text>
        <Text variant="eyebrow" style={styles.pickHead}>
          Pick someone who’s here
        </Text>
        {guests.length === 0 ? (
          <Text variant="caption" color="muted">
            Nobody has joined yet. Invite guests first.
          </Text>
        ) : (
          [...guests]
            .sort((a, b) => b.photosUsed - a.photosUsed)
            .slice(0, 8)
            .map((g) => (
              <Pressable key={g.userId} accessibilityRole="button" onPress={() => promote(g)} style={styles.pick}>
                <Initials name={g.name} />
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{g.name}</Text>
                  <Text variant="caption" color="muted">
                    {g.photosUsed} shots so far
                  </Text>
                </View>
                <Plus size={18} color={colors.primary} />
              </Pressable>
            ))
        )}
      </Sheet>

      <Sheet visible={Boolean(menuFor)} onClose={() => setMenuFor(null)}>
        {menuFor && (
          <>
            <View style={styles.row}>
              <Initials name={menuFor.name} size={46} />
              <View style={styles.flex}>
                <Text variant="h3">{menuFor.name}</Text>
                <Text variant="caption" color="muted">
                  {used(menuFor)} used
                </Text>
              </View>
            </View>
            <View style={styles.menu}>
              <Pressable accessibilityRole="button" onPress={() => promote(menuFor)} style={[styles.menuRow, full && { opacity: 0.45 }]}>
                <Aperture size={19} color={colors.accent} />
                <View style={styles.flex}>
                  <Text variant="body">Make designated photographer</Text>
                  <Text variant="caption" color="muted">
                    {full
                      ? `All ${MAX_PHOTOGRAPHERS} slots are taken. Remove one first.`
                      : `${PHOTOGRAPHER_PHOTO_LIMIT.toLocaleString('en-US')} uploads and a badge on every shot`}
                  </Text>
                </View>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => confirmRemove(menuFor)} style={[styles.menuRow, styles.menuDivider]}>
                <Trash2 size={19} color={colors.danger} />
                <Text variant="body" color="danger">
                  Remove from event
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </Sheet>
    </View>
  );
}

function Initials({ name, badge, size = 38 }: { name: string; badge?: boolean; size?: number }) {
  const { fonts } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.initials, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ fontFamily: fonts.serif, fontSize: size * 0.37 }}>{initialsOf(name)}</Text>
      {badge && (
        <View style={styles.initialsBadge}>
          <Aperture size={11} color="#FFFFFF" />
        </View>
      )}
    </View>
  );
}

/** A bottom sheet over the screen, like the prototype's. */
function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.grabber} />
        {children}
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { padding: screenPadding, paddingBottom: space['4xl'], gap: space.md },
  flex: { flex: 1, minWidth: 0, gap: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  card: { borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 14, gap: space.sm + 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  statusPill: { paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: space.sm, backgroundColor: colors.sage },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.field, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
  },
  slotIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  guestHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg },
  guest: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 3, borderBottomWidth: 0.5, borderBottomColor: colors.line },
  guestText: { gap: space.xs },
  miniTrack: { width: 56, height: 4, borderRadius: 2, backgroundColor: colors.field, overflow: 'hidden' },
  miniFill: { height: '100%', backgroundColor: colors.sageDeep },
  more: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  initials: { backgroundColor: colors.sage, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  initialsBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    // Always dark, so the white aperture reads on light and dark themes alike.
    backgroundColor: '#273C32',
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: space.xl, paddingTop: space.sm + 2, gap: space.md },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, marginBottom: space.xs },
  pickHead: { marginTop: space.sm },
  pick: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2, borderBottomWidth: 0.5, borderBottomColor: colors.line },
  menu: { borderRadius: radius.lg + 2, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: 14 },
  menuDivider: { borderTopWidth: 0.5, borderTopColor: colors.line },
}));
