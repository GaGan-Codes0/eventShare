import { router } from 'expo-router';
import { ArrowUpRight, Camera, ChevronRight, CloudUpload, Heart, QrCode } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Banner, Button, Header, IconButton, IconTile, LoadingState, PhotoTile, SectionHeading, Text } from '@/components/ui';
import { colors, radius, screenPadding, space } from '@/constants/theme';
import { EventCover } from '@/features/events/event-cover';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { retryNow } from '@/features/uploads/queue';
import { useUploadQueue } from '@/features/uploads/use-upload-queue';
import { useMe, usePhotos } from '@/services/api/hooks';
import { plural } from '@/utils/format';

export default function Home() {
  const { id, event, query } = useCurrentEvent();
  const me = useMe();
  const photos = usePhotos(id);
  const queue = useUploadQueue(id);

  if (!event) return <LoadingState />;
  const recent = photos.data?.pages[0]?.items.slice(0, 10) ?? [];

  return (
    <View style={styles.screen}>
      <Header
        right={
          <>
            <IconButton icon={QrCode} accessibilityLabel="Invite people" onPress={() => router.push('/invite')} />
            <Pressable accessibilityLabel="More" onPress={() => router.navigate('/(tabs)/more')}>
              <Avatar name={me.data?.name ?? ''} uri={me.data?.avatarUrl} />
            </Pressable>
          </>
        }
      />
      {queue.pending > 0 && (
        <Banner icon={CloudUpload}>
          {`${plural(queue.pending, 'photo')} waiting to upload. They're safe on this phone.`}
        </Banner>
      )}
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching || photos.isRefetching}
            onRefresh={() => {
              retryNow();
              void query.refetch();
              void photos.refetch();
            }}
          />
        }>
        <EventCover event={event} imageUri={recent[0]?.thumbUrl} />

        <View style={styles.roll}>
          <IconTile icon={Camera} />
          <View style={styles.flex}>
            <Text variant="h3">A shared roll.</Text>
            <Text variant="caption" color="muted">
              {plural(event.photoCount, 'photo')} from {plural(event.memberCount, 'guest')} so far
            </Text>
          </View>
        </View>
        <Button
          label="Open your camera"
          leadingIcon={Camera}
          trailingIcon={ArrowUpRight}
          fullWidth
          onPress={() => router.navigate('/(tabs)/camera')}
        />

        <View style={styles.section}>
          <SectionHeading
            eyebrow="Through everyone's eyes"
            title="Little moments, kept."
            onPressMore={recent.length > 0 ? () => router.navigate('/(tabs)/album') : undefined}
            moreLabel="Open the album"
          />
          {recent.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
              {recent.map((p) => (
                <View key={p.id} style={styles.stripItem}>
                  <PhotoTile
                    uri={p.thumbUrl}
                    height={150}
                    title={p.uploader.name}
                    accessibilityLabel={`Photo by ${p.uploader.name}`}
                    onPress={() => router.push({ pathname: '/photo/[id]', params: { id: p.id, eventId: event.id } })}
                  />
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text color="muted">No photos yet. Be the first — open your camera.</Text>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/invite')}
          style={({ pressed }) => [styles.invite, pressed && { opacity: 0.85 }]}>
          <IconTile icon={Heart} tone="warm" />
          <View style={styles.flex}>
            <Text variant="h3">Invite your people</Text>
            <Text variant="caption" color="muted">
              Share the QR or code. Everyone’s photos land here.
            </Text>
          </View>
          <ChevronRight size={18} color={colors.subtle} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: screenPadding, paddingBottom: space['4xl'], gap: space.lg },
  roll: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  flex: { flex: 1, gap: 2 },
  section: { marginTop: space.lg },
  strip: { gap: space.sm + 1 },
  stripItem: { width: 116 },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    marginTop: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.warm,
  },
});
