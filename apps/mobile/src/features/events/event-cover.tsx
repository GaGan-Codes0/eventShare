import type { EventSummary } from '@eventshare/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radius, space } from '@/constants/theme';
import { formatEventDate } from '@/utils/format';

/** Design §6 EventCover: photo (or deep green), date eyebrow, serif title, location. */
export function EventCover({ event, imageUri }: { event: EventSummary; imageUri?: string | null }) {
  const date = formatEventDate(event.startsAt);
  const [first, ...rest] = event.name.split(' & ');
  return (
    <View style={styles.cover} accessibilityRole="header" accessibilityLabel={event.name}>
      {imageUri && <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />}
      <LinearGradient colors={['transparent', colors.photoShade]} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.badge}>
        <View style={styles.badgeDot} />
        <Text variant="eyebrow" style={styles.light}>
          {event.role === 'host' ? "You're hosting" : "You're a guest"}
        </Text>
      </View>
      <View style={styles.text}>
        {date && (
          <Text variant="eyebrow" style={styles.light}>
            {date}
          </Text>
        )}
        <Text variant="display" style={styles.light} numberOfLines={3}>
          {first}
          {rest.length > 0 && (
            <Text variant="display" emphasis color="viewfinderAccent">
              {'\n& '}
              {rest.join(' & ')}
            </Text>
          )}
        </Text>
        {event.location && (
          <View style={styles.row}>
            <MapPin size={14} color={colors.viewfinderText} />
            <Text variant="caption" style={styles.light}>
              {event.location}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    height: 300,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.viewfinder,
    justifyContent: 'flex-end',
  },
  badge: {
    position: 'absolute',
    top: space.lg,
    left: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  badgeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.viewfinderAccent },
  text: { padding: space.xl, gap: space.sm },
  light: { color: colors.viewfinderText },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
