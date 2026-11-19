import { PLANS, type EventSummary, type Plan } from '@eventshare/shared';
import { router } from 'expo-router';
import { Lock } from 'lucide-react-native';
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
}));
