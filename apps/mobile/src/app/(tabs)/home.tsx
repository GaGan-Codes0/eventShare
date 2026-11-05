import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Aperture, Camera, ChevronRight, Lock, MapPin } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, screenPadding, space } from '@/constants/theme';
import { GuestHeader } from '@/features/events/event-header';
import { hostShort, longDate } from '@/features/events/identity';
import { NoEventYet } from '@/features/events/no-event';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { lockText, openPhoto } from '@/features/gallery/album-view';
import { PhotoCell } from '@/features/gallery/photo-grid';
import { useUploadQueue } from '@/features/uploads/use-upload-queue';
import { usePhotos } from '@/services/api/hooks';
import { makeStyles, useTheme } from '@/theme';

/** A guest's view of the event: who, where, your roll, the shot list and what's coming in. */
export default function EventHome() {
  const { colors, fonts } = useTheme();
  const styles = useStyles();
  const { id, event, query } = useCurrentEvent();
  const photos = usePhotos(id);
  const queue = useUploadQueue(id);
  if (!id) return <NoEventYet title="Home" />;
  if (!event) return <View style={styles.screen} />;

  const photographer = event.role === 'photographer';
  const limit = event.photoLimit;
  const used = event.photosUsed + queue.unreserved;
  const left = limit === null ? null : Math.max(0, limit - used);
  const strip = (photos.data?.pages[0]?.items ?? []).slice(0, 8);

  return (
    <View style={styles.screen}>
      <GuestHeader event={event} />
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
        <View style={styles.hero}>
          {event.coverUrl && <Image source={{ uri: event.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />}
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.62)']} locations={[0.3, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroText}>
            {event.startsAt && (
              <Text variant="eyebrow" style={styles.heroEyebrow}>
                {longDate(event.startsAt)}
              </Text>
            )}
            <Text variant="display" style={styles.heroName}>
              {event.name}
            </Text>
            {event.location && (
              <View style={styles.row}>
                <MapPin size={13} color="#FFFFFF" />
                <Text variant="caption" style={styles.heroVenue}>
                  {event.location}
                </Text>
              </View>
            )}
          </View>
        </View>

        {event.tagline && (
          <Text color="muted" style={styles.tagline}>
            “{event.tagline}” <Text color="muted">— {hostShort(event)}</Text>
          </Text>
        )}

        <View style={styles.roll}>
          <View style={styles.rollTop}>
            <View style={styles.rollLeft}>
              <View style={styles.row}>
                {photographer && <Aperture size={13} color={colors.primaryText} />}
                <Text variant="eyebrow" style={{ color: colors.primaryText }}>
                  {photographer ? 'Photographer pass' : 'Your roll'}
                </Text>
              </View>
              <View style={styles.leftRow}>
                <Text style={[styles.leftBig, { fontFamily: fonts.mono }]}>{left === null ? '∞' : left}</Text>
                <Text variant="caption" color="muted">
                  {left === null ? 'no limit tonight' : `of ${limit} left`}
                </Text>
              </View>
            </View>
            <Text variant="mono" color="muted">
              {used} taken
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${left === null || !limit ? 100 : (left / limit) * 100}%` }]} />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate('/(tabs)/camera')}
            style={({ pressed }) => [styles.cta, pressed && { transform: [{ scale: 0.98 }] }]}>
            <Camera size={18} color={colors.onPrimary} />
            <Text variant="bodyStrong" style={{ color: colors.onPrimary }}>
              Open camera
            </Text>
          </Pressable>
        </View>

        {event.prompts.length > 0 && (
          <View style={styles.section}>
            <Text variant="eyebrow">Shot list from {hostShort(event)}</Text>
            <View style={styles.prompts}>
              {event.prompts.map((p) => (
                <Pressable
                  key={p}
                  accessibilityRole="button"
                  accessibilityHint="Opens the camera for this shot"
                  onPress={() => router.navigate({ pathname: '/(tabs)/camera', params: { prompt: p } })}
                  style={styles.prompt}>
                  <Camera size={13} color={colors.ink} />
                  <Text variant="label">{p}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text variant="bodyStrong">From the room</Text>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.navigate('/(tabs)/album')} style={styles.row}>
              <Text variant="label" style={{ color: colors.primaryText }}>
                See all
              </Text>
              <ChevronRight size={15} color={colors.primaryText} />
            </Pressable>
          </View>
          {!event.albumOpen ? (
            <View style={styles.locked}>
              <View style={styles.lockIcon}>
                <Lock size={18} color={colors.primaryText} />
              </View>
              <View style={styles.flex}>
                <Text variant="bodyStrong">Developing…</Text>
                <Text variant="caption" color="muted">
                  {lockText(event)} Keep shooting, your photos are safe.
                </Text>
              </View>
            </View>
          ) : strip.length > 0 ? (
            <View style={styles.strip}>
              {[strip.slice(0, 4), strip.slice(4, 8)].filter((r) => r.length).map((r, i) => (
                <View key={i} style={styles.stripRow}>
                  {r.map((p) => (
                    <PhotoCell key={p.id} tile={{ kind: 'remote', photo: p }} onOpen={openPhoto} />
                  ))}
                  {Array.from({ length: 4 - r.length }, (_, j) => (
                    <View key={j} style={styles.flex} />
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <Text variant="caption" color="muted">
              Photos everyone takes will show up here.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { paddingHorizontal: screenPadding - 4, paddingTop: 6, paddingBottom: space['3xl'], gap: space.lg - 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  flex: { flex: 1 },
  hero: { height: 246, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.sage },
  heroText: { position: 'absolute', left: 18, right: 18, bottom: 16, gap: 6 },
  heroEyebrow: { color: '#FFFFFF', opacity: 0.92, fontSize: 10, lineHeight: 13 },
  heroName: { color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 14 },
  heroVenue: { color: '#FFFFFF', opacity: 0.92 },
  tagline: { paddingHorizontal: space.xs },
  roll: { borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: space.lg, gap: space.md },
  rollTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: space.sm },
  rollLeft: { gap: 6 },
  leftRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  leftBig: { fontSize: 34, lineHeight: 38, letterSpacing: -0.6, color: colors.ink },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.sage, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  cta: { height: 48, borderRadius: 14, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  section: { gap: space.sm + 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  prompts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.full, backgroundColor: colors.sage },
  strip: { gap: space.xs },
  stripRow: { flexDirection: 'row', gap: space.xs },
  locked: { borderRadius: 18, backgroundColor: colors.sage, padding: 18, flexDirection: 'row', alignItems: 'center', gap: space.md },
  lockIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
}));
