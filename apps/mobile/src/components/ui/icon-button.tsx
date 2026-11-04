import type { LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { icon, radius, type ColorToken } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';

export type IconButtonProps = {
  icon: LucideIcon;
  /** Required: icon-only buttons must be labelled for screen readers. */
  accessibilityLabel: string;
  onPress?: () => void;
  outlined?: boolean;
  color?: ColorToken;
  size?: number;
};

export function IconButton({ icon: Icon, accessibilityLabel, onPress, outlined, color = 'ink', size = 40 }: IconButtonProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={size < 44 ? (44 - size) / 2 : 0}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size },
        outlined && styles.outlined,
        pressed && { backgroundColor: colors.field },
      ]}>
      <Icon size={icon.md} color={colors[color]} strokeWidth={icon.stroke} />
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  base: { borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  outlined: { borderWidth: 1, borderColor: colors.lineStrong },
}));
