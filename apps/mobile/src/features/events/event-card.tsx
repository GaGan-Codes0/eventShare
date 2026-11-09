import { shootingPhase, type EventIdentity, type EventSummary } from '@eventshare/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';
import { plural } from '@/utils/format';

import { monogram, shortDate, TYPE_LABEL } from './identity';
import { ROLE_LABEL } from './roles';

/** An event's badge: the host's logo, or its monogram in the event's heading font. */
type BadgeEvent = Pick<EventIdentity, 'name' | 'type' | 'partner1' | 'partner2' | 'joiner' | 'organizer' | 'logoUrl'>;

export function EventBadge({ event, size }: { event: BadgeEvent; size: number }) {
  const styles = useStyles();
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}>
      {event.logoUrl ? (
        <Image source={{ uri: event.logoUrl }} style={styles.badgeLogo} contentFit="contain" />
      ) : (
        <Text variant="h3" style={[styles.badgeText, { fontSize: size * 0.34, lineHeight: size * 0.42 }]}>
          {monogram(event)}
        </Text>
      )}
    </View>
  );
}

/**
 * One event on "Your events": its cover, status, type, name in the event's own font, and
 * what's in it. Drawn in whatever theme it sits under, including the host's poster frame.
 */
export function EventCard({ event, onPress }: { event: EventSummary; onPress: () => void }) {
  const { colors, frame } = useTheme();
  const styles = useStyles();
  const closed = shootingPhase('host', event.startsAt) === 'closed';
  const live = event.memberCount > 1 && !closed;
  const meta = [
    shortDate(event.startsAt),
    plural(event.photoCount, 'photo'),
    plural(Math.max(0, event.memberCount - 1), 'guest'),
    ROLE_LABEL[event.role],
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.name}, ${meta}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.cover, frame === 'polaroid' && styles.coverMat]}>
        <View style={[styles.picture, frame === 'polaroid' && styles.pictureMat]}>
          {event.coverUrl && <Image source={{ uri: event.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.35)']} locations={[0.4, 1]} style={StyleSheet.absoluteFill} />
          {(frame === 'line' || frame === 'double') && <View pointerEvents="none" style={[styles.rule, styles.ruleOuter]} />}
          {frame === 'double' && <View pointerEvents="none" style={[styles.rule, styles.ruleInner]} />}
          <View style={styles.status}>
            <View style={[styles.statusDot, !live && { backgroundColor: colors.subtle }]} />
            <Text variant="eyebrow" style={styles.statusText}>
              {closed ? 'Uploads closed' : live ? 'Live now' : 'Ready for guests'}
            </Text>
          </View>
        </View>
        <View style={styles.badgeSpot}>
          <EventBadge event={event} size={48} />
        </View>
      </View>
      <View style={styles.body}>
        <Text variant="eyebrow" style={{ color: colors.primaryText }}>
          {TYPE_LABEL[event.type]}
        </Text>
        <Text variant="h2" numberOfLines={2} style={styles.name}>
          {event.name}
        </Text>
        <Text variant="caption" color="muted">
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}

/** The cover's top corners, and the poster frame's insets inside them. */
const CORNER = radius.xl + 1;
const RULE_OUTER = 7;
const RULE_INNER = 11;

const useStyles = makeStyles(({ colors }) => ({
  card: {
    borderRadius: radius.xl + 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: '#1C2420',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  cover: { height: 118, borderTopLeftRadius: CORNER, borderTopRightRadius: CORNER, backgroundColor: colors.sage },
  coverMat: { backgroundColor: colors.surface, padding: space.sm, paddingBottom: 0 },
  picture: { flex: 1, overflow: 'hidden', borderTopLeftRadius: CORNER, borderTopRightRadius: CORNER, backgroundColor: colors.sage },
  pictureMat: { borderRadius: 4 },
  rule: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
  // Concentric with the card's rounded corner (radius minus the inset), so the lines follow the
  // curve and never poke outside it, whether or not the platform clips them.
  ruleOuter: { top: RULE_OUTER, left: RULE_OUTER, right: RULE_OUTER, bottom: RULE_OUTER, borderRadius: CORNER - RULE_OUTER },
  ruleInner: { top: RULE_INNER, left: RULE_INNER, right: RULE_INNER, bottom: RULE_INNER, borderRadius: CORNER - RULE_INNER },
  status: {
    position: 'absolute',
    top: space.md,
    left: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3F9A4F' },
  statusText: { color: '#273C32', fontSize: 10, lineHeight: 14, letterSpacing: 1 },
  badgeSpot: { position: 'absolute', right: 14, bottom: -22 },
  badge: {
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.surface,
    shadowColor: colors.line,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badgeLogo: { width: '76%', height: '76%' },
  badgeText: { color: colors.primaryText },
  body: { paddingHorizontal: space.lg, paddingTop: space.md + 2, paddingBottom: space.lg, gap: 6 },
  name: { paddingRight: 50 },
}));
