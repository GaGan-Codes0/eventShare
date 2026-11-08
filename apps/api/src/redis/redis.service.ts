import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';

import { ENV, type Env } from '../config/env.js';

/**
 * Redis for speed, never for truth: every method here fails open. If Redis is down, reads come
 * back empty and writes are dropped, and callers fall back to the database or do the work inline.
 */
@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly log = new Logger(RedisService.name);
  private readonly client: Redis | null;
  private subscriber: Redis | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {
    // No offline queue and one retry: a cache that's down must answer "no" at once, not hang a request.
    this.client = env.REDIS_URL ? new Redis(env.REDIS_URL, { enableOfflineQueue: false, maxRetriesPerRequest: 1 }) : null;
    this.client?.on('error', (err: Error) => this.log.warn(`Redis: ${err.message}`));
  }

  get url() {
    return this.env.REDIS_URL;
  }

  private async attempt<T>(work: (r: Redis) => Promise<T>): Promise<T | null> {
    if (!this.client) return null;
    try {
      return await work(this.client);
    } catch (err) {
      this.log.warn(`Redis command skipped: ${String(err)}`);
      return null;
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.attempt((r) => r.get(key));
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlSeconds: number) {
    await this.attempt((r) => r.set(key, JSON.stringify(value), 'EX', ttlSeconds));
  }

  /** Several plain strings at once; missing ones (or Redis being down) come back null. */
  async mget(keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) return [];
    return (await this.attempt((r) => r.mget(keys))) ?? keys.map(() => null);
  }

  async msetEx(entries: [string, string][], ttlSeconds: number) {
    if (entries.length === 0) return;
    await this.attempt((r) => {
      const pipe = r.pipeline();
      for (const [k, v] of entries) pipe.set(k, v, 'EX', ttlSeconds);
      return pipe.exec();
    });
  }

  async hincr(key: string, field: string, ttlSeconds: number) {
    await this.attempt(async (r) => {
      await r.pipeline().hincrby(key, field, 1).expire(key, ttlSeconds).exec();
    });
  }

  async hgetall(key: string): Promise<Record<string, string> | null> {
    return this.attempt((r) => r.hgetall(key));
  }

  async publish(channel: string, message: string) {
    await this.attempt((r) => r.publish(channel, message));
  }

  /** Listens on a channel for the life of the process (a subscribed connection can do nothing else). */
  async subscribe(channel: string, onMessage: (message: string) => void) {
    if (!this.env.REDIS_URL) return;
    this.subscriber ??= new Redis(this.env.REDIS_URL, { maxRetriesPerRequest: null });
    this.subscriber.on('error', (err: Error) => this.log.warn(`Redis subscriber: ${err.message}`));
    this.subscriber.on('message', (ch: string, message: string) => {
      if (ch === channel) onMessage(message);
    });
    await this.subscriber.subscribe(channel).catch((err: unknown) => this.log.warn(`Redis subscribe failed: ${String(err)}`));
  }

  onApplicationShutdown() {
    this.client?.disconnect();
    this.subscriber?.disconnect();
  }
}
