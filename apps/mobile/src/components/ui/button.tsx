import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { icon, radius, space, type ColorToken } from '@/constants/theme';
import { useTheme } from '@/theme';

import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const palette: Record<Variant, { bg: ColorToken | null; pressed: ColorToken | null; fg: ColorToken; border?: ColorToken }> = {
  primary: { bg: 'primary', pressed: 'primaryPressed', fg: 'onPrimary' },
  secondary: { bg: 'field', pressed: 'sage', fg: 'ink', border: 'lineStrong' },
  ghost: { bg: null, pressed: 'field', fg: 'accent' },
  danger: { bg: 'dangerBg', pressed: 'warmDeep', fg: 'danger' },
};

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  leadingIcon?: LucideIcon;
  trailingIcon?: LucideIcon;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  leadingIcon: Leading,
  trailingIcon: Trailing,
  fullWidth,
  disabled,
  loading,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const p = palette[variant];
  const fg = colors[p.fg];
  const spread = Boolean(Leading && Trailing);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.full,
        p.bg && { backgroundColor: colors[pressed && p.pressed ? p.pressed : p.bg] },
        !p.bg && pressed && p.pressed && { backgroundColor: colors[p.pressed] },
        p.border && { borderWidth: 1, borderColor: colors[p.border] },
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={[styles.row, spread && styles.spread]}>
          {Leading && <Leading size={icon.md} color={fg} strokeWidth={icon.stroke} />}
          <Text variant="label" style={{ color: fg }}>
            {label}
          </Text>
          {Trailing && <Trailing size={icon.md} color={fg} strokeWidth={icon.stroke} />}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  full: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  spread: { alignSelf: 'stretch', justifyContent: 'space-between' },
  pressed: { transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
});
