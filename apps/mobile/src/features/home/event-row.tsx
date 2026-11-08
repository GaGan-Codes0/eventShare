import type { EventSummary } from '@eventshare/shared';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { monogram, shortDate } from '@/features/events/identity';
import { plural } from '@/utils/format';
import { defaultTheme, makeStyles, themeFor, ThemeProvider, useTheme } from '@/theme';

const ROLE = { host: 'Hosting', photographer: 'Photographer', member: 'Guest' } as const;

/** "212 photos · 38 guests" for the host; your shots left for everyone else. */
function rowCaption(e: EventSummary) {
  if (e.role === 'host') return `${plural(e.photoCount, 'photo')} · ${plural(Math.max(0, e.memberCount - 1), 'guest')}`;
  if (e.photoLimit === null) return `${e.photosUsed.toLocaleString('en-US')} shots taken`;
  return `${Math.max(0, e.photoLimit - e.photosUsed)} of ${e.photoLimit.toLocaleString('en-US')} shots left`;
}

/**
 * The prototype's compact event row (My events, "Pick up where you left off"): its cover or
 * monogram, a role badge and date, the name in the event's own font, and how it's going.
 */
export function EventRow({ event, onPress }: { event: EventSummary; onPress: () => void }) {
  return (
    <ThemeProvider theme={themeFor(event.theme)}>
      <Row event={event} onPress={onPress} />
    </ThemeProvider>
  );
}

function Row({ event, onPress }: { event: EventSummary; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const host = event.role === 'host';
  const base = defaultTheme.colors;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.name}, ${ROLE[event.role]}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: base.field }]}>
      <View style={[styles.thumb, { backgroundColor: colors.sage }]}>
        {event.coverUrl ? (
          <Image source={{ uri: event.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Text variant="h3" style={[styles.mono, { color: colors.accent }]}>
            {monogram(event)}
          </Text>
        )}
      </View>
      <View style={styles.middle}>
        <View style={styles.topLine}>
          <View style={[styles.badge, { backgroundColor: host ? base.ink : base.sage }]}>
            <Text style={[styles.badgeText, { color: host ? base.paper : base.primary }]}>{ROLE[event.role]}</Text>
          </View>
          <Text variant="caption" style={styles.date}>
            {shortDate(event.startsAt)}
          </Text>
        </View>
        {/* The name in the event's own font and size (20 at its scale). */}
        <Text variant="h3" numberOfLines={1} style={{ color: base.ink }}>
          {event.name}
        </Text>
        <Text variant="caption" style={styles.sub}>
          {rowCaption(event)}
        </Text>
      </View>
      <ChevronRight size={18} color={base.subtle} />
    </Pressable>
  );
}

// The row itself is in eventShare's look; only the thumbnail and the name take the event's.
const useStyles = makeStyles(() => {
  const c = defaultTheme.colors;
  return {
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 10,
      borderRadius: 18,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.line,
    },
    thumb: { width: 56, height: 70, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    mono: { fontSize: 17, lineHeight: 22 },
    middle: { flex: 1, minWidth: 0, gap: 3 },
    topLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    badge: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 6 },
    badgeText: { fontFamily: defaultTheme.fonts.sansSemiBold, fontSize: 9.5, lineHeight: 15, letterSpacing: 0.57, textTransform: 'uppercase' },
    date: { fontSize: 12, lineHeight: 16, color: c.muted },
    sub: { fontSize: 12.5, lineHeight: 16, color: c.muted },
  };
});
