import type { EventSummary } from '@eventshare/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radius, space } from '@/constants/theme';
import { plural } from '@/utils/format';

import { ROLE_LABEL } from './roles';

/** One event on the events home, album-style: its cover photo (or deep green), name, and what's in it. */
export function EventPoster({ event, current, onPress }: { event: EventSummary; current?: boolean; onPress: () => void }) {
  const details = `${plural(event.photoCount, 'photo')} · ${plural(event.memberCount, 'person', 'people')}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.name}, ${ROLE_LABEL[event.role]}, ${details}${current ? ', open now' : ''}`}
      accessibilityState={{ selected: current }}
      onPress={onPress}
      style={({ pressed }) => [styles.poster, current && styles.current, pressed && styles.pressed]}>
      {event.coverUrl && <Image source={{ uri: event.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />}
      <LinearGradient colors={['transparent', colors.photoShade]} locations={[0.2, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.role}>
        <Text variant="eyebrow" style={styles.light}>
          {current ? `${ROLE_LABEL[event.role]} · Open` : ROLE_LABEL[event.role]}
        </Text>
      </View>
      <View style={styles.text}>
        <Text variant="h3" style={styles.light} numberOfLines={2}>
          {event.name}
        </Text>
        <Text variant="caption" style={styles.dim} numberOfLines={1}>
          {details}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  poster: {
    flex: 1,
    aspectRatio: 0.9,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.viewfinder,
    justifyContent: 'flex-end',
  },
  current: { borderWidth: 2.5, borderColor: colors.focus },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  role: {
    position: 'absolute',
    top: space.sm,
    left: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  text: { padding: space.md, gap: 2 },
  light: { color: colors.viewfinderText },
  dim: { color: colors.viewfinderText, opacity: 0.8 },
});
