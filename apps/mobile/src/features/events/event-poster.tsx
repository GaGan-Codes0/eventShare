import type { EventSummary } from '@eventshare/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';
import { plural } from '@/utils/format';

import { EventLogo } from './event-images';
import { ROLE_LABEL } from './roles';

/**
 * One event, album-style: its cover photo (or the theme's deep colour), name, and what's in it.
 * Drawn in whatever theme it sits under, including the host's poster frame.
 */
export function EventPoster({ event, current, onPress }: { event: EventSummary; current?: boolean; onPress?: () => void }) {
  const { colors, frame } = useTheme();
  const styles = useStyles();
  const details = `${plural(event.photoCount, 'photo')} · ${plural(event.memberCount, 'person', 'people')}`;
  return (
    <View style={styles.cell}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${event.name}, ${ROLE_LABEL[event.role]}, ${details}${current ? ', open now' : ''}`}
        accessibilityState={{ selected: current }}
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [styles.poster, frame === 'polaroid' && styles.polaroid, current && styles.current, pressed && styles.pressed]}>
        <View style={[styles.picture, frame === 'polaroid' && styles.polaroidPicture]}>
          {event.coverUrl && <Image source={{ uri: event.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />}
          <LinearGradient colors={['transparent', colors.photoShade]} locations={[0.2, 1]} style={StyleSheet.absoluteFill} />
          {frame === 'line' && <View pointerEvents="none" style={[styles.rule, styles.ruleOuter]} />}
          {frame === 'double' && (
            <>
              <View pointerEvents="none" style={[styles.rule, styles.ruleOuter]} />
              <View pointerEvents="none" style={[styles.rule, styles.ruleInner]} />
            </>
          )}
          <View style={styles.role}>
            <Text variant="eyebrow" style={styles.light}>
              {current ? `${ROLE_LABEL[event.role]} · Open` : ROLE_LABEL[event.role]}
            </Text>
          </View>
          <View style={styles.text}>
            {event.logoUrl && (
              <View style={styles.logo}>
                <EventLogo uri={event.logoUrl} size={36} />
              </View>
            )}
            <Text variant="h3" style={styles.light} numberOfLines={2}>
              {event.name}
            </Text>
            <Text variant="caption" style={styles.dim} numberOfLines={1}>
              {details}
            </Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  // Its own cell, so the poster's size comes from the column width, never from what's inside it.
  cell: { flex: 1 },
  poster: {
    aspectRatio: 0.9,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.viewfinder,
  },
  // The white border is margin on the picture, so the poster keeps the same size as unframed ones.
  polaroid: { borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  current: { borderWidth: 2.5, borderColor: colors.focus },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  picture: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.viewfinder },
  polaroidPicture: { margin: space.sm, marginBottom: space['2xl'], borderRadius: 3, overflow: 'hidden' },
  rule: { position: 'absolute', borderWidth: 1, borderColor: colors.viewfinderAccent, opacity: 0.85 },
  ruleOuter: { top: 7, left: 7, right: 7, bottom: 7, borderRadius: radius.xl - 7 },
  ruleInner: { top: 11, left: 11, right: 11, bottom: 11, borderRadius: radius.xl - 11 },
  role: {
    position: 'absolute',
    top: space.md,
    left: space.md,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  text: { padding: space.lg, gap: 2 },
  logo: { marginBottom: space.sm },
  light: { color: colors.viewfinderText },
  dim: { color: colors.viewfinderText, opacity: 0.8 },
}));
