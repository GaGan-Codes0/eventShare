import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, icon, radius, space, type ColorToken } from '@/constants/theme';

import { Text } from './text';

export function MenuLabel({ children }: { children: string }) {
  return (
    <Text variant="eyebrow" style={styles.label}>
      {children}
    </Text>
  );
}

/** Rounded card holding MenuRows, with hairlines between rows. */
export function MenuGroup({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <View style={styles.group}>
      {rows.map((row, i) => (
        <Fragment key={i}>
          {i > 0 && <View style={styles.divider} />}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

export function MenuRow({
  icon: Icon,
  title,
  caption,
  onPress,
  trailing,
  tone = 'ink',
}: {
  icon?: LucideIcon;
  title: string;
  caption?: string;
  onPress?: () => void;
  trailing?: ReactNode;
  tone?: ColorToken;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={caption ? `${title}, ${caption}` : title}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.field }]}>
      {Icon && <Icon size={icon.sm} color={colors[tone === 'ink' ? 'accent' : tone]} strokeWidth={icon.stroke} />}
      <View style={styles.text}>
        <Text variant="body" color={tone}>
          {title}
        </Text>
        {caption && (
          <Text variant="caption" color="subtle">
            {caption}
          </Text>
        )}
      </View>
      {trailing ?? (onPress && <ChevronRight size={16} color={colors.subtle} strokeWidth={icon.stroke} />)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: space.lg, marginBottom: space.md },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    marginBottom: space.lg,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.lineStrong },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md + 1 },
  text: { flex: 1, gap: 2 },
});
