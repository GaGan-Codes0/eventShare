import type { Photo } from '@eventshare/shared';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import { Camera, EyeOff, ImageOff } from 'lucide-react-native';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { Button, EmptyState, Header, LoadingState, PhotoTile, Text } from '@/components/ui';
import { colors, screenPadding, space } from '@/constants/theme';
import { NoEventYet } from '@/features/events/no-event';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { retryNow, type QueueItem } from '@/features/uploads/queue';
import { useUploadQueue } from '@/features/uploads/use-upload-queue';
import { usePhotos } from '@/services/api/hooks';
import { plural, timeAgo } from '@/utils/format';

type Tile = { kind: 'local'; item: QueueItem } | { kind: 'remote'; photo: Photo; frame: number };

export default function Album() {
  const { id, event } = useCurrentEvent();
  const photos = usePhotos(id);
  const queue = useUploadQueue(id);

  const tiles = useMemo<Tile[]>(() => {
    const remote = photos.data?.pages.flatMap((p) => p.items) ?? [];
    const total = event?.photoCount ?? remote.length;
    return [
      ...queue.items.map((item) => ({ kind: 'local' as const, item })),
      ...remote.map((photo, i) => ({ kind: 'remote' as const, photo, frame: Math.max(total - i, 1) })),
    ];
  }, [photos.data, queue.items, event?.photoCount]);

  if (!id) return <NoEventYet title="The album" />;
  if (!event || photos.isPending) return <LoadingState />;

  return (
    <View style={styles.screen}>
      <Header title="The album" />
      <FlatList
        data={tiles}
        keyExtractor={(t) => (t.kind === 'local' ? `local-${t.item.id}` : t.photo.id)}
        numColumns={2}
        columnWrapperStyle={styles.columns}
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
        ListHeaderComponent={
          <View style={styles.intro}>
            <Text variant="eyebrow">{event.name}</Text>
            <Text variant="h1">
              Every moment, <Text variant="h1" emphasis>every way.</Text>
            </Text>
            <Text variant="caption" color="muted">
              {plural(event.photoCount, 'memory', 'memories')} from the people who were there.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={ImageOff}
            title="Nothing here yet"
            message="Photos anyone takes at this event will appear here for everyone."
            action={<Button label="Open camera" leadingIcon={Camera} onPress={() => router.navigate('/(tabs)/camera')} />}
          />
        }
        ListFooterComponent={photos.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : undefined}
        renderItem={({ item: t }) =>
          t.kind === 'local' ? (
            <View style={styles.cell}>
              <PhotoTile
                uri={new File(Paths.document, 'uploads', t.item.thumbName).uri}
                status={t.item.permanent ? "Couldn't upload" : 'Uploading…'}
                title="You"
                caption={t.item.permanent ? t.item.error : 'Saved on this phone'}
              />
            </View>
          ) : (
            <View style={styles.cell}>
              <PhotoTile
                uri={t.photo.thumbUrl}
                frameNumber={t.frame}
                status={t.photo.visibility === 'hidden' ? 'Hidden' : undefined}
                title={t.photo.uploader.name}
                caption={timeAgo(t.photo.createdAt)}
                accessibilityLabel={`Photo by ${t.photo.uploader.name}, ${timeAgo(t.photo.createdAt)}`}
                onPress={() => router.push({ pathname: '/photo/[id]', params: { id: t.photo.id, eventId: event.id } })}
              />
              {t.photo.visibility === 'hidden' && <EyeOff size={14} color={colors.white} style={styles.hiddenIcon} />}
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingHorizontal: screenPadding, paddingBottom: space['4xl'], gap: space.lg + 1 },
  columns: { gap: space.sm + 2 },
  cell: { flex: 1 / 2 },
  intro: { gap: space.sm, paddingTop: space['2xl'], paddingBottom: space.sm },
  hiddenIcon: { position: 'absolute', top: space.sm, right: space.sm },
});
