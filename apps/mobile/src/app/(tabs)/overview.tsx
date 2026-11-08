import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Calendar, ChevronRight, Download, Eye, MapPin, QrCode, ShieldCheck } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Button, LoadingState, Text } from '@/components/ui';
import { MAX_PHOTOGRAPHERS, PHOTOGRAPHER_PHOTO_LIMIT } from '@eventshare/shared';
import { radius, screenPadding, space } from '@/constants/theme';
import { EventBadge } from '@/features/events/event-card';
import { HostHeader } from '@/features/events/event-header';
import { longDate } from '@/features/events/identity';
import { NoEventYet } from '@/features/events/no-event';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { openGuestView } from '@/features/events/open-event';
import { openPhoto } from '@/features/gallery/album-view';
import { FilteredImage } from '@/features/gallery/photo-filters';
import { PhotoCell } from '@/features/gallery/photo-grid';
import { useMembers, usePhotographerInvites, usePhotos } from '@/services/api/hooks';
import { makeStyles, ThemeProvider, useEventLook, useTheme } from '@/theme';

/** The host's dashboard: the event, how it's going, invite, shoot, review, and the live feed. */
export default function Overview() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { id, event, query } = useCurrentEvent();
  const photos = usePhotos(id);
  const look = useEventLook();
  if (!id) return <NoEventYet title="Overview" />;
  if (!event) return <LoadingState />;

  const latest = (photos.data?.pages[0]?.items ?? []).filter((p) => !p.pendingReview).slice(0, 6);
  const live = event.memberCount > 1;

  return (
    <View style={styles.screen}>
      <HostHeader event={event} title="Overview" />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => {
              void query.refetch();
              void photos.refetch();
            }}
          />
        }>
        <View style={styles.card}>
          {/* The cover is what guests see: the event's own badge and name font. */}
          <ThemeProvider theme={look}>
            <View style={styles.cover}>
              <FilteredImage uri={event.coverUrl} filter={event.posterUrl ? 'natural' : event.filter} style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
              <View style={styles.status}>
                <View style={[styles.statusDot, !live && { backgroundColor: colors.subtle }]} />
                <Text variant="eyebrow" style={styles.statusText}>
                  {live ? 'Live · uploads open' : 'Ready for guests'}
                </Text>
              </View>
              <View style={styles.badge}>
                <EventBadge event={event} size={40} />
              </View>
              <Text variant="h1" numberOfLines={2} style={styles.coverName}>
                {event.name}
              </Text>
            </View>
          </ThemeProvider>
          <View style={styles.cardInfo}>
            <View style={styles.row}>
              <Calendar size={14} color={colors.muted} />
              <Text variant="caption" color="muted">
                {event.startsAt ? longDate(event.startsAt) : 'No date set'}
              </Text>
            </View>
            <View style={styles.row}>
              <MapPin size={14} color={colors.muted} />
              <Text variant="caption" color="muted">
                {event.location ?? 'Venue to be announced'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.stats}>
          <Stat value={String(Math.max(0, event.memberCount - 1))} label="Guests in" />
          <Stat value={String(event.photoCount)} label="Photos" />
          <Stat value={`${event.photographerCount}/${MAX_PHOTOGRAPHERS}`} label="Photographers" />
        </View>

        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button label="Invite guests" leadingIcon={QrCode} fullWidth onPress={() => router.push('/invite')} />
          </View>
          <View style={styles.flex}>
            <Button label="Download all" leadingIcon={Download} variant="secondary" fullWidth onPress={() => router.push('/download')} />
          </View>
        </View>
        {/* As in the prototype: the host sees and shoots as guests do, with no shot limit. */}
        <Pressable accessibilityRole="button" onPress={openGuestView} style={({ pressed }) => [styles.guestView, pressed && { backgroundColor: colors.field }]}>
          <View style={styles.guestViewIcon}>
            <Eye size={18} color={colors.ink} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.guestViewTitle}>Open guest view</Text>
            <Text style={styles.guestViewCaption}>See it and shoot as your guests do. No shot limit for hosts.</Text>
          </View>
          <ChevronRight size={16} color={colors.ink} />
        </Pressable>

        {event.pendingReviewCount > 0 && (
          <Pressable accessibilityRole="button" onPress={() => router.navigate('/(tabs)/gallery')} style={styles.review}>
            <ShieldCheck size={18} color={colors.notice} />
            <Text variant="label" color="notice" style={styles.flex}>
              {event.pendingReviewCount} guest photo{event.pendingReviewCount === 1 ? '' : 's'} waiting for your review
            </Text>
            <ChevronRight size={16} color={colors.notice} />
          </Pressable>
        )}

        <View style={styles.feedHead}>
          <View style={styles.row}>
            <View style={styles.liveDot} />
            <Text variant="eyebrow">Live feed</Text>
          </View>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.navigate('/(tabs)/gallery')} style={styles.row}>
            <Text variant="label">Gallery</Text>
            <ChevronRight size={15} color={colors.ink} />
          </Pressable>
        </View>
        {latest.length > 0 ? (
          <View style={styles.feed}>
            {[latest.slice(0, 3), latest.slice(3, 6)].filter((r) => r.length).map((r, i) => (
              <View key={i} style={styles.feedRow}>
                {r.map((p) => (
                  <PhotoCell key={p.id} tile={{ kind: 'remote', photo: p }} onOpen={openPhoto} filter={event.filter} />
                ))}
                {Array.from({ length: 3 - r.length }, (_, j) => (
                  <View key={j} style={styles.flex} />
                ))}
              </View>
            ))}
          </View>
        ) : (
          <Text variant="caption" color="muted">
            Photos show up here as soon as guests start shooting.
          </Text>
        )}

        <PhotographersCard eventId={event.id} />
      </ScrollView>
    </View>
  );
}

/**
 * As in the prototype: each designated photographer (joined or still invited) with their
 * uploads out of 1,000, and Manage to go to People.
 */
function PhotographersCard({ eventId }: { eventId: string }) {
  const styles = useStyles();
  const members = useMembers(eventId);
  const invites = usePhotographerInvites(eventId);
  const rows = [
    ...(members.data ?? []).filter((m) => m.role === 'photographer').map((m) => ({ key: m.userId, name: m.name, uploads: m.photosUsed })),
    ...(invites.data ?? []).map((i) => ({ key: i.id, name: i.name || i.email, uploads: 0 })),
  ];
  return (
    <View style={styles.phCard}>
      <View style={styles.phHead}>
        <Text style={styles.phTitle}>Designated photographers</Text>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.navigate('/(tabs)/people')}>
          <Text style={styles.phManage}>Manage</Text>
        </Pressable>
      </View>
      {rows.length === 0 ? (
        <Text style={styles.phEmpty}>
          None yet. Add up to {MAX_PHOTOGRAPHERS} people with {PHOTOGRAPHER_PHOTO_LIMIT.toLocaleString('en-US')} uploads each.
        </Text>
      ) : (
        rows.map((r) => (
          <View key={r.key} style={styles.phRow}>
            <View style={styles.phLine}>
              <Text style={styles.phName} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={styles.phCount}>
                {r.uploads.toLocaleString('en-US')} / {PHOTOGRAPHER_PHOTO_LIMIT.toLocaleString('en-US')}
              </Text>
            </View>
            <View style={styles.phTrack}>
              <View style={[styles.phFill, { width: `${Math.min(100, (r.uploads / PHOTOGRAPHER_PHOTO_LIMIT) * 100)}%` }]} />
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text variant="h2">{value}</Text>
      <Text variant="caption" color="muted">
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors, fonts }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { padding: screenPadding - 4, paddingBottom: space['3xl'], gap: space.md + 2 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  card: { borderRadius: radius.xl + 2, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  cover: { height: 168, backgroundColor: colors.sage, justifyContent: 'flex-end', padding: space.lg },
  status: {
    position: 'absolute',
    top: space.md,
    left: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3F9A4F' },
  statusText: { color: '#273C32', fontSize: 10, lineHeight: 14, letterSpacing: 1 },
  badge: { position: 'absolute', top: space.md, right: space.md },
  coverName: { color: '#FFFFFF' },
  cardInfo: { padding: space.lg, gap: 6 },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 2 },
  actions: { flexDirection: 'row', gap: space.sm },
  review: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
    padding: space.md + 2,
    borderRadius: radius.lg,
    backgroundColor: colors.noticeBg,
  },
  feedHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  feed: { gap: space.xs },
  feedRow: { flexDirection: 'row', gap: space.xs },
  guestView: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  guestViewIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  guestViewTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, lineHeight: 18, color: colors.ink },
  guestViewCaption: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 16, color: colors.muted },
  // The prototype's card: 18 round, hairline edge, 14/16 padding, rows 12 apart.
  phCard: { borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  phHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  phTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, lineHeight: 18, color: colors.ink },
  phManage: { fontFamily: fonts.sansSemiBold, fontSize: 13, lineHeight: 18, color: colors.primary },
  phEmpty: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, color: colors.muted },
  phRow: { gap: 6 },
  phLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  phName: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18, color: colors.ink },
  phCount: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 18, color: colors.muted },
  phTrack: { height: 5, borderRadius: 3, backgroundColor: colors.field, overflow: 'hidden' },
  phFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
}));
