import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, icon, radius, space } from '@/constants/theme';

import { Text } from './text';

export function Pill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text variant="caption" color="accent" style={styles.pillText}>
        {label}
      </Text>
    </View>
  );
}

export function IconTile({ icon: Icon, tone = 'sage' }: { icon: LucideIcon; tone?: 'sage' | 'warm' }) {
  return (
    <View style={[styles.tile, { backgroundColor: colors[tone === 'warm' ? 'warmDeep' : 'sage'] }]}>
      <Icon size={icon.md} color={colors.ink} strokeWidth={icon.stroke} />
    </View>
  );
}

export function Banner({ tone = 'notice', icon: Icon, children, action }: {
  tone?: 'notice' | 'danger';
  icon?: LucideIcon;
  children: string;
  action?: ReactNode;
}) {
  const fg = colors[tone];
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: colors[tone === 'notice' ? 'noticeBg' : 'dangerBg'] }]}>
      {Icon && <Icon size={16} color={fg} strokeWidth={icon.stroke} />}
      <Text variant="caption" style={[styles.bannerText, { color: fg }]}>
        {children}
      </Text>
      {action}
    </View>
  );
}

export function EmptyState({ icon, title, message, action }: {
  icon: LucideIcon;
  title: ReactNode;
  message: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <IconTile icon={icon} />
      <Text variant="h2" align="center">
        {title}
      </Text>
      <Text variant="caption" color="muted" align="center" style={styles.emptyMessage}>
        {message}
      </Text>
      {action}
    </View>
  );
}

export function LoadingState() {
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { backgroundColor: colors.sage, borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 3 },
  pillText: { fontSize: 11, lineHeight: 14 },
  tile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md - 2 },
  bannerText: { flex: 1 },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space['4xl'], paddingHorizontal: space.lg },
  emptyMessage: { maxWidth: 280, marginBottom: space.sm },
});
