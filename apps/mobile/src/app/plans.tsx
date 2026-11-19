import { PLAN_IDS, PLANS, type Plan } from '@eventshare/shared';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { Button, LoadingState, Text } from '@/components/ui';
import { toast } from '@/components/toast';
import { screenPadding, space } from '@/constants/theme';
import { planOf, rupees, shortDate } from '@/features/events/plan';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { useChangePlan } from '@/services/api/hooks';
import { makeStyles, useTheme } from '@/theme';

const secs = (ms: number) => `${Math.round(ms / 1000)}-second`;

/** What each package gives, in the order hosts compare them. */
function features(p: Plan): string[] {
  return [
    `${p.maxGuests} guests, up to ${p.maxGuestShots} photos each`,
    `One ${secs(p.guestVideoMs)} video and a voice message per guest`,
    `${p.photographers === 1 ? 'One photographer' : `${p.photographers} photographers`}: ${p.photographerPhotos.toLocaleString('en-IN')} photos and ${p.photographerVideos} video${p.photographerVideos === 1 ? '' : 's'}`,
    'Ready-made themes, Me search and saving photos',
    ...(p.customLook ? ['Your own colours and fonts'] : []),
    ...(p.downloadAll ? ['Download every original as a ZIP'] : []),
    ...(p.branding ? ['Your logo, photo frames and approving photos'] : []),
    `Gallery open for ${p.accessDays === 365 ? '12 months' : `${p.accessDays} days`}`,
  ];
}

/** Host: the event's package and the bigger ones it can move to. One payment per event. */
export default function Plans() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { id, event } = useCurrentEvent();
  const change = useChangePlan(id ?? '');
  const [picked, setPicked] = useState<string | null>(null);
  if (!event) return <LoadingState />;
  const current = planOf(event);
  const currentIndex = PLAN_IDS.indexOf(current.id);

  function upgrade(p: Plan) {
    Alert.alert(`Upgrade to ${p.name}?`, `${rupees(p.priceInr)} for this event, paid once.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Upgrade',
        onPress: () => {
          setPicked(p.id);
          change.mutate(p.id, {
            onSuccess: () => toast(`${event?.name ?? 'Your event'} is now on ${p.name}`),
            onError: (e) => toast(e instanceof Error ? e.message : 'Could not upgrade. Please try again.'),
            onSettled: () => setPicked(null),
          });
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <View style={styles.head}>
        <Text variant="eyebrow">Packages</Text>
        <Text variant="h2">One payment per event</Text>
        <Text color="muted">
          Guests and photographers always join free. {event.name} is on {current.name}: {event.guestCount} of {current.maxGuests} guests, gallery
          open until {shortDate(event.accessEndsAt)}.
        </Text>
      </View>

      {PLAN_IDS.map((planId, i) => {
        const p = PLANS[planId];
        const isCurrent = p.id === current.id;
        const below = i < currentIndex;
        return (
          <View key={p.id} style={[styles.card, isCurrent && styles.cardCurrent, below && styles.cardBelow]}>
            <View style={styles.cardHead}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.price}>{p.priceInr === 0 ? 'Free' : rupees(p.priceInr)}</Text>
            </View>
            {features(p).map((f) => (
              <View key={f} style={styles.feature}>
                <Check size={15} color={colors.accent} />
                <Text variant="caption" style={styles.flex}>
                  {f}
                </Text>
              </View>
            ))}
            {isCurrent ? (
              <Text variant="label" color="muted" style={styles.status}>
                Your package
              </Text>
            ) : below ? null : (
              <Button
                label={`Upgrade for ${rupees(p.priceInr)}`}
                fullWidth
                loading={picked === p.id}
                disabled={change.isPending}
                onPress={() => upgrade(p)}
              />
            )}
          </View>
        );
      })}

      <Text variant="caption" color="muted" style={styles.foot}>
        More than 300 guests or several venues? Write to support@klyra.co.in for a custom package.
      </Text>
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors, fonts }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { paddingHorizontal: screenPadding, paddingTop: space['2xl'], paddingBottom: space['3xl'], gap: space.md },
  head: { gap: space.sm, marginBottom: space.sm },
  flex: { flex: 1 },
  card: { gap: space.sm, padding: 16, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  cardCurrent: { borderColor: colors.accent, borderWidth: 2 },
  cardBelow: { opacity: 0.55 },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 17, lineHeight: 22, color: colors.ink },
  price: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 26, color: colors.ink },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  status: { marginTop: space.xs },
  foot: { textAlign: 'center', marginTop: space.sm },
}));
