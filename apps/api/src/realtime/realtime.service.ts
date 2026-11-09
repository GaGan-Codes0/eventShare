import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { EventLive } from '@eventshare/shared';

import { QueueService } from '../redis/queue.service.js';
import { RedisService } from '../redis/redis.service.js';

const CHANNEL = 'event-updates';
const NOTIFY_QUEUE = 'notify-event';
/** However fast photos arrive, an event's phones hear about it at most this often. */
const COALESCE_MS = 2000;
const COUNTER_TTL = 60 * 60 * 24 * 30;
/** Without Redis, the live endpoint moves on this often, so phones still refresh now and then. */
const FALLBACK_BUCKET_MS = 30_000;

const counterKey = (eventId: string) => `event:${eventId}:live`;

/**
 * Tells phones an event changed. Each event has two counters in Redis (new photos; anything else).
 * A burst of changes becomes one delayed job, which publishes the counters to every API server;
 * each server pushes them to the phones connected to it.
 */
@Injectable()
export class RealtimeService implements OnModuleInit {
  private listeners = new Set<(eventId: string, live: EventLive) => void>();

  constructor(
    private readonly redis: RedisService,
    private readonly queue: QueueService,
  ) {}

  onModuleInit() {
    this.queue.register<{ eventId: string }>(NOTIFY_QUEUE, ({ eventId }) => this.publish(eventId), 5);
    // Not awaited: the API must start even if Redis is down.
    void this.redis.subscribe(CHANNEL, (message) => {
      const { eventId, live } = JSON.parse(message) as { eventId: string; live: EventLive };
      for (const l of this.listeners) l(eventId, live);
    });
  }

  onUpdate(listener: (eventId: string, live: EventLive) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Something in the event changed: a photo went live ('new'), or a hide, delete, approval or rule ('rev'). */
  async touch(eventId: string, field: keyof EventLive) {
    await this.redis.hincr(counterKey(eventId), field, COUNTER_TTL);
    // One job id per event: while one is waiting, more changes simply join it.
    const queued = await this.queue.add(NOTIFY_QUEUE, { eventId }, { jobId: `notify-${eventId}`, delay: COALESCE_MS, removeOnFail: true });
    if (!queued) await this.publish(eventId);
  }

  private async publish(eventId: string) {
    await this.redis.publish(CHANNEL, JSON.stringify({ eventId, live: await this.current(eventId) }));
  }

  async current(eventId: string): Promise<EventLive> {
    const counters = await this.redis.hgetall(counterKey(eventId));
    if (counters === null) {
      // Redis is down: a value that moves on its own keeps phones refreshing slowly.
      const bucket = Math.floor(Date.now() / FALLBACK_BUCKET_MS);
      return { new: bucket, rev: 0, refill: bucket };
    }
    return { new: Number(counters.new ?? 0), rev: Number(counters.rev ?? 0), refill: Number(counters.refill ?? 0) };
  }
}
