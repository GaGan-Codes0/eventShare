import type { EventDetail } from '@eventshare/shared';
import { router } from 'expo-router';
import { ChevronLeft, QrCode } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Text } from '@/components/ui';
import { icon, radius, screenPadding, space } from '@/constants/theme';
import { useMe } from '@/services/api/hooks';
import { makeStyles, useTheme } from '@/theme';

import { EventBadge } from './event-card';

/** Host screens: back to Your events, the event's name over the screen title, and its QR. */
export function HostHeader({ event, title, right }: { event: EventDetail | null; title: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel="Your events" hitSlop={10} onPress={() => router.navigate('/events')}>
          <ChevronLeft size={icon.lg} color={colors.ink} strokeWidth={icon.stroke} />
        </Pressable>
        <View style={styles.titles}>
          <Text variant="eyebrow" numberOfLines={1} style={styles.eyebrow}>
            {event?.name ?? ''}
          </Text>
          <Text variant="title" accessibilityRole="header" numberOfLines={1}>
            {title}
          </Text>
        </View>
        {right ?? (
          <Pressable accessibilityRole="button" accessibilityLabel="Invite guests: QR and code" hitSlop={10} onPress={() => router.push('/invite')}>
            <QrCode size={icon.lg} color={colors.ink} strokeWidth={icon.stroke} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Guest screens: the event's badge, "Live now" and its name; your profile on the right. */
export function GuestHeader({ event, dark }: { event: EventDetail | null; dark?: boolean }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const me = useMe();
  return (
    <View style={[styles.bar, styles.plain, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        {event && <EventBadge event={event} size={36} />}
        <View style={styles.titles}>
          <View style={styles.live}>
            <View style={[styles.liveDot, { backgroundColor: colors.primary }]} />
            <Text variant="eyebrow" style={[styles.liveText, { color: dark ? colors.viewfinderAccent : colors.primary }]}>
              Live now
            </Text>
          </View>
          <Text variant="h3" numberOfLines={1} style={dark && { color: colors.viewfinderText }}>
            {event?.name ?? ''}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Your profile" hitSlop={8} onPress={() => router.push({ pathname: '/profile', params: { from: 'event' } })}>
          <Avatar name={me.data?.name ?? ''} uri={me.data?.avatarUrl} />
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  bar: { backgroundColor: colors.paper, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  plain: { borderBottomWidth: 0 },
  row: { height: 56, flexDirection: 'row', alignItems: 'center', gap: space.md - 2, paddingHorizontal: screenPadding - 4 },
  titles: { flex: 1, minWidth: 0, gap: 1 },
  eyebrow: { fontSize: 10, lineHeight: 13 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 5, height: 5, borderRadius: radius.full },
  liveText: { fontSize: 9.5, lineHeight: 13 },
}));
