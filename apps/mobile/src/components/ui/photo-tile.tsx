import { Image } from 'expo-image';
import { Pressable, StyleSheet, View, type DimensionValue } from 'react-native';

import { radius, space } from '@/constants/theme';
import { makeStyles } from '@/theme';

import { Text } from './text';

export type PhotoTileProps = {
  uri?: string | null;
  frameNumber?: number;
  status?: string;
  title?: string;
  caption?: string;
  height?: DimensionValue;
  aspectRatio?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** A photo with reserved space (no layout jump), optional mono frame number and caption. */
export function PhotoTile({
  uri,
  frameNumber,
  status,
  title,
  caption,
  height,
  aspectRatio = 4 / 5,
  onPress,
  accessibilityLabel,
}: PhotoTileProps) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={accessibilityLabel ?? title ?? 'Photo'}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={[styles.image, height ? { height } : { aspectRatio }]}>
        {uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />}
        {status && (
          <View style={styles.status}>
            <Text variant="caption" style={styles.statusText}>
              {status}
            </Text>
          </View>
        )}
        {frameNumber !== undefined && (
          <Text variant="mono" style={styles.frame}>
            {String(frameNumber).padStart(2, '0')}
          </Text>
        )}
      </View>
      {(title || caption) && (
        <View style={styles.caption}>
          {title && (
            <Text variant="label" numberOfLines={1}>
              {title}
            </Text>
          )}
          {caption && (
            <Text variant="caption" color="muted" numberOfLines={1}>
              {caption}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: { flex: 1, minWidth: 0 },
  image: { width: '100%', borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.sage },
  status: {
    position: 'absolute',
    top: space.sm,
    left: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.sm - 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusText: { fontSize: 11, lineHeight: 14 },
  frame: { position: 'absolute', left: space.md, bottom: space.md, color: colors.white, opacity: 0.9 },
  caption: { paddingTop: space.sm, paddingHorizontal: 2, gap: 2 },
}));
