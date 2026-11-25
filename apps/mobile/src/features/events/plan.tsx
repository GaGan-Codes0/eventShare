import { PLANS, type EventSummary, type Plan, type PlanId } from '@eventshare/shared';
import { router } from 'expo-router';
import { Lock, Star } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { makeStyles, useTheme } from '@/theme';

export function planOf(event: Pick<EventSummary, 'plan'>): Plan {
  return PLANS[event.plan];
}

/** Opens the packages sheet for the current event. */
export function openPlans() {
  router.push('/plans');
}

/** "₹2,499" */
export function rupees(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

/** "12 Jan 2027": the day the gallery closes. */
export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** A small "🔒 Celebration" pill on something the package doesn't include; tapping it shows the packages. */
export function PlanLock({ plan }: { plan: Plan }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Comes with ${plan.name}. See packages`} hitSlop={6} onPress={openPlans} style={styles.lock}>
      <Lock size={11} color={colors.ink} />
      <Text style={styles.lockText}>{plan.name}</Text>
    </Pressable>
  );
}

/** A row's note when it's locked: "Comes with Branded Event". */
export function LockedNote({ plan }: { plan: Plan }) {
  const styles = useStyles();
  return (
    <View style={styles.note}>
      <PlanLock plan={plan} />
    </View>
  );
}

/** How many stars each paid package shows. */
const STARS: Record<PlanId, number> = { free: 0, party: 1, celebration: 2, branded: 3 };

/** A paid event's package as stars: one for Party, two for Celebration, three for Branded Event. Nothing for Free. */
export function PlanTag({ event, onCover }: { event: Pick<EventSummary, 'plan'>; onCover?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const count = STARS[event.plan];
  if (!count) return null;
  const color = onCover ? '#273C32' : colors.onPrimary;
  return (
    <View accessible accessibilityLabel={`${planOf(event).name} package`} style={[styles.tag, onCover && styles.tagCover]}>
      {Array.from({ length: count }, (_, i) => (
        <Star key={i} size={10} color={color} fill={color} strokeWidth={2} />
      ))}
    </View>
  );
}

const useStyles = makeStyles(({ colors, fonts }) => ({
  lock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.sage,
  },
  lockText: { fontFamily: fonts.sansSemiBold, fontSize: 11.5, lineHeight: 14, color: colors.ink },
  note: { marginTop: 4 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  tagCover: { backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 8, paddingVertical: 5 },
}));
