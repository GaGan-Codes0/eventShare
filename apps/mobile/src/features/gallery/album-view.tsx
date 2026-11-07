import type { EventDetail, Photo, PhotoListFilter } from '@eventshare/shared';
import { router } from 'expo-router';
import { Camera, Download, Images, Lock, ScanFace } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chips, LoadingState, Text } from '@/components/ui';
import { radius, screenPadding, space } from '@/constants/theme';
import { HostHeader } from '@/features/events/event-header';
import { retryNow } from '@/features/uploads/queue';
import { useUploadQueue } from '@/features/uploads/use-upload-queue';
import { useMe, usePhotos } from '@/services/api/hooks';
import { makeStyles, useTheme } from '@/theme';
import { plural } from '@/utils/format';

import { PhotoCell, tileKey, type Tile } from './photo-grid';

const GUEST_FILTERS: { value: PhotoListFilter; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'photographers', label: 'Photographers' },
  { value: 'mine', label: 'Mine' },
];
/** Find my photos: the photos your face is in. */
const ME_FILTER = { value: 'me', label: 'Me' } as const;

/** "The album opens when the event ends." */
export function lockText(event: Pick<EventDetail, 'revealMode' | 'albumOpensAt'>) {
  if (!event.albumOpensAt) return 'The album opens soon.';
  const at = new Date(event.albumOpensAt);
  const when = at.toLocaleString('en-GB', { weekday: 'long', hour: 'numeric', minute: '2-digit' });
  return event.revealMode === 'morning' ? `The album opens ${when}, like collecting prints.` : `The album opens when the event ends (${when}).`;
}

export function openPhoto(photo: Photo) {
  router.push({ pathname: '/photo/[id]', params: { id: photo.id, eventId: photo.eventId } });
}

/**
 * Guests: "The album" with Everyone / Photographers / Mine, locked until it opens.
 * Host (Gallery): every photo, plus the review queue and hidden ones.
 */
export function AlbumView({ event, host }: { event: EventDetail; host: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const [picked, setFilter] = useState<PhotoListFilter>('all');
  // "Me" falls back to everything if the hosts turn Find my photos off while it's showing.
  const filter = picked === 'me' && !event.findMyPhotos ? 'all' : picked;
  // "Me" before you've taken your selfie: show how to start instead of the photos.
  const needsSelfie = filter === 'me' && !event.hasFaceProfile;
  const photos = usePhotos(event.id, filter);
  const queue = useUploadQueue(event.id);
  const locked = !host && !event.albumOpen && filter !== 'mine';

  const hostFilters = useMemo(() => {
    const chips: { value: PhotoListFilter; label: string }[] = [
      { value: 'all', label: 'All' },
      { value: 'photographers', label: 'Photographers' },
      { value: 'guests', label: 'Guests' },
    ];
    if (event.requireReview || event.pendingReviewCount > 0) chips.push({ value: 'review', label: `Review · ${event.pendingReviewCount}` });
    chips.push({ value: 'hidden', label: 'Hidden' });
    if (event.findMyPhotos) chips.push(ME_FILTER);
    return chips;
  }, [event.requireReview, event.pendingReviewCount, event.findMyPhotos]);
  const guestFilters = useMemo(() => (event.findMyPhotos ? [...GUEST_FILTERS, ME_FILTER] : GUEST_FILTERS), [event.findMyPhotos]);

  // Host: faces in photos from before Find my photos was on are found on this phone, in the background.
  const [backfilled, setBackfilled] = useState(0);
  useEffect(() => {
    if (!host || !event.findMyPhotos) return;
    import('@/features/faces/scan').then(({ backfill }) => backfill(event.id, setBackfilled)).catch(() => undefined);
  }, [host, event.id, event.findMyPhotos]);

  const tiles = useMemo<Tile[]>(() => {
    const remote = photos.data?.pages.flatMap((p) => p.items) ?? [];
    const local = filter === 'all' || filter === 'mine' ? queue.items.map((item) => ({ kind: 'local' as const, item })) : [];
    return [...local, ...remote.map((photo) => ({ kind: 'remote' as const, photo }))];
  }, [photos.data, queue.items, filter]);

  const rows = useMemo(() => {
    const out: Tile[][] = [];
    for (let i = 0; i < tiles.length; i += 3) out.push(tiles.slice(i, i + 3));
    return out;
  }, [tiles]);

  const header = host ? null : (
    <View style={[styles.guestTop, { paddingTop: insets.top + space.md }]}>
      <Text variant="h1">The album</Text>
      <Text variant="caption" color="muted">
        {plural(event.photoCount, 'photo')} from {plural(event.memberCount, 'person', 'people')}
      </Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      {host && <HostHeader event={event} title="Gallery" />}
      {header}
      <View style={styles.chips}>
        {host ? (
          <Chips accessibilityLabel="Show" options={hostFilters} value={filter} onChange={setFilter} />
        ) : (
          <Chips accessibilityLabel="Show" options={guestFilters} value={filter} onChange={setFilter} />
        )}
        {host && (
          <View style={styles.captionRow}>
            <Text variant="caption" color="muted">
              {filter === 'all'
                ? `Latest of ${plural(event.photoCount, 'photo')}`
                : needsSelfie
                  ? 'Photos you’re in'
                  : plural(tiles.length, 'photo')}
              {backfilled > 0 && ` · faces found in ${plural(backfilled, 'older photo')}`}
            </Text>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/download')} style={styles.downloadLink}>
              <Download size={15} color={colors.ink} />
              <Text variant="label">Download</Text>
            </Pressable>
          </View>
        )}
        {filter === 'me' && event.hasFaceProfile && (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/find-me')} style={styles.downloadLink}>
            <ScanFace size={15} color={colors.ink} />
            <Text variant="caption" color="muted">
              Photos your face is in · <Text variant="label">Change</Text>
            </Text>
          </Pressable>
        )}
      </View>
      {needsSelfie ? (
        <View style={styles.body}>
          <View style={[styles.locked, { backgroundColor: colors.sage }]}>
            <View style={styles.lockIcon}>
              <ScanFace size={20} color={colors.primaryText} />
            </View>
            <Text variant="h2">Find the photos you’re in</Text>
            <Text variant="caption" color="muted" align="center" style={styles.lockText}>
              Take a selfie and see every photo your face is in. Your selfie stays on your phone.
            </Text>
            <Button label="Take a selfie" leadingIcon={ScanFace} onPress={() => router.push('/find-me')} style={styles.emptyCta} />
          </View>
        </View>
      ) : photos.isPending ? (
        <LoadingState />
      ) : (
        <FlatList
          data={locked ? [] : rows}
          keyExtractor={(row) => tileKey(row[0])}
          contentContainerStyle={styles.body}
          onEndReached={() => photos.hasNextPage && !photos.isFetchingNextPage && photos.fetchNextPage()}
          onEndReachedThreshold={0.6}
          refreshControl={
            <RefreshControl
              refreshing={photos.isRefetching}
              onRefresh={() => {
                retryNow();
                void photos.refetch();
              }}
            />
          }
          ListEmptyComponent={
            locked ? (
              <View style={styles.locked}>
                <View style={styles.lockIcon}>
                  <Lock size={20} color={colors.primaryText} />
                </View>
                <Text variant="h2">Developing…</Text>
                <Text variant="caption" color="muted" align="center" style={styles.lockText}>
                  {lockText(event)} Your own shots are under Mine.
                </Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <View style={[styles.lockIcon, { backgroundColor: colors.sage }]}>
                  <Images size={20} color={colors.primaryText} />
                </View>
                <Text variant="h2">Nothing here yet</Text>
                <Text variant="caption" color="muted">
                  {host ? 'Photos guests take will appear here.' : 'Your shots will appear here.'}
                </Text>
                <Button label="Open camera" leadingIcon={Camera} onPress={() => router.navigate('/(tabs)/camera')} style={styles.emptyCta} />
              </View>
            )
          }
          ListFooterComponent={photos.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : undefined}
          renderItem={({ item: row }) => (
            <View style={styles.row}>
              {row.map((t) => (
                <PhotoCell key={tileKey(t)} tile={t} meId={host ? undefined : me.data?.id} onOpen={openPhoto} filter={event.filter} />
              ))}
              {Array.from({ length: 3 - row.length }, (_, i) => (
                <View key={i} style={styles.flex} />
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  guestTop: { paddingHorizontal: screenPadding, paddingBottom: space.md, gap: space.xs },
  captionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  downloadLink: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chips: { paddingHorizontal: screenPadding - 4, paddingTop: space.md, paddingBottom: space.sm, gap: space.sm },
  body: { paddingHorizontal: screenPadding - 4, paddingTop: space.xs, paddingBottom: space['4xl'], gap: space.xs },
  row: { flexDirection: 'row', gap: space.xs },
  flex: { flex: 1 },
  locked: {
    marginTop: 6,
    paddingVertical: 28,
    paddingHorizontal: 22,
    borderRadius: radius.xl + 2,
    backgroundColor: colors.sage,
    alignItems: 'center',
    gap: space.sm + 2,
  },
  lockIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  lockText: { maxWidth: 260 },
  empty: { paddingVertical: 44, paddingHorizontal: space.xl, alignItems: 'center', gap: space.sm + 2 },
  emptyCta: { marginTop: space.xs },
}));
