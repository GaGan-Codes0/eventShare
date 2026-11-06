import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { radius } from '@/constants/theme';
import { defaultTheme, makeStyles } from '@/theme';

import { Text } from './text';

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, uri, size = 34 }: { name: string; uri?: string | null; size?: 28 | 34 | 40 }) {
  const styles = useStyles();
  return (
    <View
      accessibilityLabel={name}
      style={[styles.base, { width: size, height: size }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        // People's initials stay in eventShare's own serif, whatever the event's name font.
        <Text style={{ fontFamily: defaultTheme.fonts.serif, fontSize: size * 0.4, lineHeight: size * 0.5 }}>{initialsOf(name)}</Text>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  base: {
    borderRadius: radius.full,
    backgroundColor: colors.sage,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
}));
