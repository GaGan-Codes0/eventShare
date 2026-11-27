import { upgradesFrom, upgradeProductId, type PlanId } from '@eventshare/shared';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, PRODUCT_CATEGORY, PURCHASES_ERROR_CODE, type PurchasesError } from 'react-native-purchases';

/**
 * RevenueCat's public SDK keys (Project settings → API keys). They are meant to ship inside the app.
 * Android's is empty until the Play Store app is set up in RevenueCat; without a key the app
 * upgrades without paying, which only a test server (PLAN_SELF_UPGRADE) accepts.
 */
const KEYS = {
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? 'appl_GHmesdrkEWBhpnVEUifobqQhORW',
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
};
const apiKey = Platform.OS === 'ios' ? KEYS.ios : Platform.OS === 'android' ? KEYS.android : '';

/** Whether this build takes real store payments. */
export const paymentsEnabled = !!apiKey;

let configuredFor: string | null = null;
/** One set-up at a time: prices loading while Pay is tapped must not configure RevenueCat twice. */
let setUp: Promise<void> = Promise.resolve();

/** RevenueCat knows the person by our user id, so the server can find their payments. */
function ready(userId: string) {
  setUp = setUp
    .catch(() => undefined)
    .then(async () => {
      if (configuredFor === userId) return;
      if (configuredFor === null) {
        // Release builds log only warnings and errors to the phone's log (no user ids or receipts).
        if (!__DEV__) await Purchases.setLogLevel(LOG_LEVEL.WARN);
        Purchases.configure({ apiKey, appUserID: userId });
      } else await Purchases.logIn(userId);
      configuredFor = userId;
    });
  return setUp;
}

/** Store price of moving up from `from` to each bigger package, e.g. "₹1,500.00". Empty if the store can't be reached. */
export async function storePrices(userId: string, from: PlanId): Promise<Partial<Record<PlanId, string>>> {
  if (!paymentsEnabled) return {};
  await ready(userId);
  const targets = upgradesFrom(from).map((p) => [p.id, upgradeProductId(from, p.id)] as const);
  const products = await Purchases.getProducts(
    targets.map(([, id]) => id),
    PRODUCT_CATEGORY.NON_SUBSCRIPTION,
  );
  const out: Partial<Record<PlanId, string>> = {};
  for (const [plan, id] of targets) {
    const p = products.find((x) => x.identifier === id);
    if (p) out[plan] = p.priceString;
  }
  return out;
}

/** Pays for moving an event from `from` to `to`. The payment's id, or null if the person backed out of the store sheet. */
export async function buyPlan(userId: string, from: PlanId, to: Exclude<PlanId, 'free'>): Promise<string | null> {
  await ready(userId);
  const [product] = await Purchases.getProducts([upgradeProductId(from, to)], PRODUCT_CATEGORY.NON_SUBSCRIPTION);
  if (!product) throw new Error("This package isn't available in the store right now.");
  try {
    const { transaction } = await Purchases.purchaseStoreProduct(product);
    return transaction.transactionIdentifier;
  } catch (e) {
    const err = e as Partial<PurchasesError> & { userCancelled?: boolean };
    if (err.userCancelled || err.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return null;
    if (err.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
      throw new Error('Your payment is waiting for approval. The event upgrades once it goes through.');
    }
    throw new Error(err.message ?? 'The payment did not go through.');
  }
}

/** Restore purchases: re-sends this Apple ID's / Google account's store payments to RevenueCat under this user. */
export async function syncStorePurchases(userId: string) {
  if (!paymentsEnabled) return;
  await ready(userId);
  try {
    await Purchases.restorePurchases();
  } catch (e) {
    throw new Error((e as Partial<PurchasesError>).message ?? 'Could not reach the store. Please try again.');
  }
}

/**
 * A payment the server hasn't applied yet (no signal, app closed). Kept on the phone and sent
 * again the next time Packages opens, so a host never pays twice for one upgrade.
 */
export interface PendingUpgrade {
  eventId: string;
  plan: Exclude<PlanId, 'free'>;
  transactionId: string;
}
/** One per event, so paying for a second event before the first went through can't lose the first. */
const pendingKey = (eventId: string) => `pending-upgrade.${eventId}`;
/** Where older builds kept the one pending payment. */
const LEGACY_KEY = 'pending-upgrade';

async function read(key: string): Promise<PendingUpgrade | null> {
  const raw = await SecureStore.getItemAsync(key).catch(() => null);
  try {
    return raw ? (JSON.parse(raw) as PendingUpgrade) : null;
  } catch {
    return null;
  }
}

/** This event's payment that the server hasn't applied yet, if any. */
export async function pendingUpgrade(eventId: string): Promise<PendingUpgrade | null> {
  for (const key of [pendingKey(eventId), LEGACY_KEY]) {
    const p = await read(key);
    if (p?.eventId === eventId) return p;
  }
  return null;
}

export async function setPendingUpgrade(eventId: string, p: PendingUpgrade | null) {
  if (p) return SecureStore.setItemAsync(pendingKey(eventId), JSON.stringify(p)).catch(() => undefined);
  await SecureStore.deleteItemAsync(pendingKey(eventId)).catch(() => undefined);
  if ((await read(LEGACY_KEY))?.eventId === eventId) await SecureStore.deleteItemAsync(LEGACY_KEY).catch(() => undefined);
}
