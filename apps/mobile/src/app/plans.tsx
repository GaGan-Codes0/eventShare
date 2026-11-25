import { PLAN_IDS, PLANS, upgradePriceInr, type Plan, type PlanId } from '@eventshare/shared';
import { Check } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { Button, LoadingState, Text } from '@/components/ui';
import { toast } from '@/components/toast';
import { screenPadding, space } from '@/constants/theme';
import { planOf, rupees, shortDate } from '@/features/events/plan';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { buyPlan, paymentsEnabled, pendingUpgrade, setPendingUpgrade, storePrices, syncStorePurchases } from '@/features/purchases/store';
import { ApiRequestError } from '@/services/api/client';
import { useChangePlan, useMe, useRestorePlan } from '@/services/api/hooks';
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
  const restore = useRestorePlan(id ?? '');
  const [restoring, setRestoring] = useState(false);
  const me = useMe().data;
  const [picked, setPicked] = useState<string | null>(null);
  const [prices, setPrices] = useState<Partial<Record<PlanId, string>>>({});
  const retried = useRef(false);

  // The store's own price (in the person's currency) once it loads; our rupee price until then.
  const currentPlan = event?.plan;
  useEffect(() => {
    if (!me || !currentPlan) return;
    storePrices(me.id, currentPlan).then(setPrices, () => undefined);
  }, [me, currentPlan]);

  // A payment that went through while the upgrade itself didn't reach us: apply it now.
  useEffect(() => {
    if (!id || retried.current) return;
    retried.current = true;
    void pendingUpgrade().then(async (pending) => {
      if (pending?.eventId !== id) return;
      try {
        await change.mutateAsync({ plan: pending.plan, transactionId: pending.transactionId });
        await setPendingUpgrade(null);
        toast(`Your payment went through: now on ${PLANS[pending.plan].name}`);
      } catch (e) {
        // Already applied, or not a payment we can use: stop retrying. Anything else retries next time.
        if (e instanceof ApiRequestError && (e.status === 400 || e.status === 409)) await setPendingUpgrade(null);
      }
    });
  }, [id, change]);

  if (!event) return <LoadingState />;
  const current = planOf(event);
  const currentIndex = PLAN_IDS.indexOf(current.id);
  /** What moving to `p` costs this event: the store's price once loaded, else ours (only the difference from a paid package). */
  const priceOf = (p: Plan) => prices[p.id] ?? rupees(upgradePriceInr(current.id, p.id));

  async function pay(p: Plan) {
    if (!id || !me || p.id === 'free') return;
    setPicked(p.id);
    try {
      let transactionId: string | undefined;
      if (paymentsEnabled) {
        const paid = await buyPlan(me.id, current.id, p.id);
        if (!paid) return; // Backed out of the store sheet.
        transactionId = paid;
        await setPendingUpgrade({ eventId: id, plan: p.id, transactionId });
      }
      await change.mutateAsync({ plan: p.id, transactionId });
      if (transactionId) await setPendingUpgrade(null);
      toast(`${event?.name ?? 'Your event'} is now on ${p.name}`);
    } catch (e) {
      const paidButNotApplied = paymentsEnabled && !(e instanceof ApiRequestError && e.status < 500);
      toast(
        paidButNotApplied && (await pendingUpgrade())?.eventId === id
          ? "Payment received. We'll finish the upgrade next time you open Packages."
          : e instanceof Error
            ? e.message
            : 'Could not upgrade. Please try again.',
      );
    } finally {
      setPicked(null);
    }
  }

  /**
   * Restore purchases (App Store rule 3.1.1): finishes an upgrade the phone was still holding, then
   * asks the store for this account's payments and applies any that never reached this event.
   */
  async function restorePurchases() {
    if (!id || !me || restoring) return;
    setRestoring(true);
    try {
      const pending = await pendingUpgrade();
      if (pending?.eventId === id) {
        try {
          await change.mutateAsync({ plan: pending.plan, transactionId: pending.transactionId });
          await setPendingUpgrade(null);
          return toast(`Restored: ${event?.name ?? 'Your event'} is on ${PLANS[pending.plan].name}`);
        } catch (e) {
          if (e instanceof ApiRequestError && (e.status === 400 || e.status === 409)) await setPendingUpgrade(null);
        }
      }
      await syncStorePurchases(me.id);
      const { restored } = await restore.mutateAsync();
      toast(
        restored
          ? `Restored: ${event?.name ?? 'Your event'} is on ${PLANS[restored].name}`
          : current.id === 'free'
            ? 'No unused purchases found for this account.'
            : `Your purchase is already on this event: ${current.name}.`,
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  }

  function upgrade(p: Plan) {
    // With real payments the store's own sheet is the confirmation.
    if (paymentsEnabled) return void pay(p);
    Alert.alert(`Upgrade to ${p.name}?`, `${priceOf(p)} for this event, paid once.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Upgrade', onPress: () => void pay(p) },
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
                label={current.priceInr > 0 ? `Upgrade for ${priceOf(p)} more` : `Upgrade for ${priceOf(p)}`}
                fullWidth
                loading={picked === p.id}
                disabled={picked !== null || change.isPending}
                onPress={() => upgrade(p)}
              />
            )}
          </View>
        );
      })}

      {paymentsEnabled && (
        <Button
          label="Restore purchases"
          variant="ghost"
          fullWidth
          loading={restoring}
          disabled={picked !== null || change.isPending}
          onPress={() => void restorePurchases()}
        />
      )}
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
