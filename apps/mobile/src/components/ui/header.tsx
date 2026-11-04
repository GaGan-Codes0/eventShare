import { Camera } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { icon, radius, screenPadding, space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';

import { Text } from './text';

export function Wordmark() {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.wordmark} accessibilityRole="header" accessibilityLabel="eventShare">
      <View style={styles.symbol}>
        <Camera size={16} color={colors.ink} strokeWidth={icon.stroke} />
      </View>
      <Text style={styles.wordmarkText}>eventShare</Text>
    </View>
  );
}

/** Top bar: wordmark (default) or a screen title on the left, actions on the right. */
export function Header({ title, right }: { title?: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View style={styles.inner}>
        {title ? (
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
        ) : (
          <Wordmark />
        )}
        <View style={styles.actions}>{right}</View>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, fonts }) => ({
  bar: {
    backgroundColor: colors.paper,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.lineStrong,
  },
  inner: {
    height: 60,
    paddingHorizontal: screenPadding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  symbol: {
    width: 30,
    height: 27,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: radius.sm - 1,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-7deg' }],
  },
  wordmarkText: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 30, letterSpacing: -1.2 },
}));
