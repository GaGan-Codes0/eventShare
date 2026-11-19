import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

import { ENV, type Env } from '../config/env.js';

/** One store payment as RevenueCat saw it. */
export interface VerifiedPurchase {
  /** RevenueCat's id for the payment; we store this one so the same payment can't be used twice. */
  transactionId: string;
  productId: string;
  store: string;
  sandbox: boolean;
  purchasedAt: Date;
}

interface NonSubscription {
  id: string;
  store_transaction_id?: string;
  purchase_date: string;
  store: string;
  is_sandbox: boolean;
}

/**
 * Asks RevenueCat whether a payment really happened. The app logs in to RevenueCat with our user id,
 * so a payment shows up under that user, and only that user can spend it.
 */
@Injectable()
export class RevenueCatService {
  private readonly log = new Logger(RevenueCatService.name);

  constructor(@Inject(ENV) private readonly env: Env) {}

  /** The payment for `productId` with this id (RevenueCat's or the store's) made by this user, or null. */
  async findPurchase(userId: string, productId: string, transactionId: string): Promise<VerifiedPurchase | null> {
    const key = this.env.REVENUECAT_SECRET_KEY;
    if (!key) throw new ServiceUnavailableException('Payments are not set up on this server yet.');

    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    }).catch((e: unknown) => {
      this.log.warn(`RevenueCat unreachable: ${String(e)}`);
      return null;
    });
    if (!res?.ok) {
      if (res) this.log.warn(`RevenueCat answered ${res.status} for a purchase check`);
      throw new ServiceUnavailableException('Could not check the payment right now. Please try again in a minute.');
    }

    const body = (await res.json()) as { subscriber?: { non_subscriptions?: Record<string, NonSubscription[]> } };
    const match = body.subscriber?.non_subscriptions?.[productId]?.find((p) => p.id === transactionId || p.store_transaction_id === transactionId);
    if (!match) return null;
    return { transactionId: match.id, productId, store: match.store, sandbox: match.is_sandbox, purchasedAt: new Date(match.purchase_date) };
  }
}
