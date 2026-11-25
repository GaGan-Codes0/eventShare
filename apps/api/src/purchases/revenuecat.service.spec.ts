import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '../config/env.js';
import { RevenueCatService } from './revenuecat.service.js';

const PARTY = 'in.co.klyra.eventshare.party';
const subscriber = {
  subscriber: {
    non_subscriptions: {
      [PARTY]: [{ id: 'rc_1', store_transaction_id: '2000000999', purchase_date: '2026-11-19T10:00:00Z', store: 'app_store', is_sandbox: true }],
    },
  },
};
const answer = (body: unknown, status = 200) => vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response(JSON.stringify(body), { status })));

describe('RevenueCatService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('refuses without a secret key', async () => {
    const rc = new RevenueCatService({} as Env);
    await expect(rc.findPurchase('u1', PARTY, 'rc_1')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("finds the user's payment by RevenueCat's id or the store's id", async () => {
    const fetch = answer(subscriber);
    vi.stubGlobal('fetch', fetch);
    const rc = new RevenueCatService({ REVENUECAT_SECRET_KEY: 'sk_test' } as Env);

    const byStoreId = await rc.findPurchase('user-1', PARTY, '2000000999');
    expect(byStoreId).toEqual({ transactionId: 'rc_1', productId: PARTY, store: 'app_store', sandbox: true, purchasedAt: new Date('2026-11-19T10:00:00Z') });
    expect((await rc.findPurchase('user-1', PARTY, 'rc_1'))?.transactionId).toBe('rc_1');

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.revenuecat.com/v1/subscribers/user-1');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk_test');
  });

  it('does not accept a payment for another package or an unknown id', async () => {
    vi.stubGlobal('fetch', answer(subscriber));
    const rc = new RevenueCatService({ REVENUECAT_SECRET_KEY: 'sk_test' } as Env);
    expect(await rc.findPurchase('user-1', 'in.co.klyra.eventshare.branded', 'rc_1')).toBeNull();
    expect(await rc.findPurchase('user-1', PARTY, 'rc_other')).toBeNull();
  });

  it('lists every one-off payment, oldest first', async () => {
    const body = {
      subscriber: {
        non_subscriptions: {
          ...subscriber.subscriber.non_subscriptions,
          'in.co.klyra.eventshare.party_to_branded': [{ id: 'rc_0', purchase_date: '2026-11-01T10:00:00Z', store: 'app_store', is_sandbox: false }],
        },
      },
    };
    vi.stubGlobal('fetch', answer(body));
    const rc = new RevenueCatService({ REVENUECAT_SECRET_KEY: 'sk_test' } as Env);
    const all = await rc.purchases('user-1');
    expect(all.map((p) => [p.transactionId, p.productId])).toEqual([
      ['rc_0', 'in.co.klyra.eventshare.party_to_branded'],
      ['rc_1', PARTY],
    ]);
    expect(all[1].storeTransactionId).toBe('2000000999');
  });

  it('asks to try again when RevenueCat fails', async () => {
    vi.stubGlobal('fetch', answer({ message: 'nope' }, 500));
    const rc = new RevenueCatService({ REVENUECAT_SECRET_KEY: 'sk_test' } as Env);
    await expect(rc.findPurchase('user-1', PARTY, 'rc_1')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
