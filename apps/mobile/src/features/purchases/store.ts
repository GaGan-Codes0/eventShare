import { upgradesFrom, upgradeProductId, type PlanId } from '@eventshare/shared';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Purchases, { PRODUCT_CATEGORY, PURCHASES_ERROR_CODE, type PurchasesError } from 'react-native-purchases';

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

/** RevenueCat knows the person by our user id, so the server can find their payments. */
async function ready(userId: string) {
  if (configuredFor === userId) return;
  if (configuredFor === null) Purchases.configure({ apiKey, appUserID: userId });
  else await Purchases.logIn(userId);
  configuredFor = userId;
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
const PENDING_KEY = 'pending-upgrade';

export async function pendingUpgrade(): Promise<PendingUpgrade | null> {
  const raw = await SecureStore.getItemAsync(PENDING_KEY).catch(() => null);
  try {
    return raw ? (JSON.parse(raw) as PendingUpgrade) : null;
  } catch {
    return null;
  }
}

export async function setPendingUpgrade(p: PendingUpgrade | null) {
  await (p ? SecureStore.setItemAsync(PENDING_KEY, JSON.stringify(p)) : SecureStore.deleteItemAsync(PENDING_KEY)).catch(() => undefined);
}
