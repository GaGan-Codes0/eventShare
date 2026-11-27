import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { radius } from '@/constants/theme';
import { defaultTheme, makeStyles, useTheme } from '@/theme';

import { Text } from './text';

/** A word's first character, whole: an emoji or accented letter is never cut in half. */
const firstChar = (word: string) => Array.from(word)[0] ?? '';

export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  // Initials come from words that start with a letter, in any script ("Zoë Ñúñez 📸" → "ZÑ");
  // a name of only emoji keeps its first one.
  const lettered = words.filter((w) => /^\p{L}/u.test(w));
  const parts = lettered.length ? lettered : words;
  if (parts.length === 0) return '?';
  const picked = parts.length === 1 ? [parts[0]] : [parts[0], parts[parts.length - 1]];
  return picked.map(firstChar).join('').toLocaleUpperCase();
}

/**
 * Someone's photo or initials. `brand` (eventShare's own screens): DM Serif with a thin ring.
 * `event` (inside an event's header): DM Sans semibold on the event's soft colour, no ring.
 * Both as in the prototype.
 */
export function Avatar({ name, uri, size = 34, variant = 'brand' }: { name: string; uri?: string | null; size?: 28 | 34 | 40; variant?: 'brand' | 'event' }) {
  const styles = useStyles();
  const { fonts } = useTheme();
  return (
    <View
      accessibilityLabel={name}
      style={[styles.base, variant === 'event' && styles.event, { width: size, height: size }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Text
          style={
            variant === 'event'
              ? { fontFamily: fonts.sansSemiBold, fontSize: size * 0.35, lineHeight: size * 0.45 }
              : // eventShare's own serif, whatever the event's name font.
                { fontFamily: defaultTheme.fonts.serif, fontSize: size * 0.4, lineHeight: size * 0.5 }
          }>
          {initialsOf(name)}
        </Text>
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
  event: { borderWidth: 0 },
}));
