import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Calendar, Camera, ChevronRight, Download, MapPin, QrCode, ShieldCheck } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Button, LoadingState, Text } from '@/components/ui';
import { MAX_PHOTOGRAPHERS } from '@eventshare/shared';
import { radius, screenPadding, space } from '@/constants/theme';
import { EventBadge } from '@/features/events/event-card';
import { HostHeader } from '@/features/events/event-header';
import { longDate } from '@/features/events/identity';
import { NoEventYet } from '@/features/events/no-event';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { openPhoto } from '@/features/gallery/album-view';
import { FilteredImage } from '@/features/gallery/photo-filters';
import { PhotoCell } from '@/features/gallery/photo-grid';
import { usePhotos } from '@/services/api/hooks';
import { makeStyles, useTheme } from '@/theme';

/** The host's dashboard: the event, how it's going, invite, shoot, review, and the live feed. */
export default function Overview() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { id, event, query } = useCurrentEvent();
  const photos = usePhotos(id);
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
        <Button label="Open camera" leadingIcon={Camera} variant="ghost" fullWidth onPress={() => router.navigate('/(tabs)/camera')} />

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
      </ScrollView>
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

const useStyles = makeStyles(({ colors }) => ({
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
}));
