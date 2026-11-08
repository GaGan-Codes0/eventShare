import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { Queue, Worker, type JobsOptions } from 'bullmq';
import { Redis, type RedisOptions } from 'ioredis';

import { ENV, type Env } from '../config/env.js';

type Handler<T> = (data: T) => Promise<void>;

const ADD_TIMEOUT_MS = 1000;
const SHUTDOWN_TIMEOUT_MS = 5000;
const timeout = (ms: number) =>
  new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms).unref();
  });

/**
 * Background jobs (BullMQ on Redis). `add` returns false when the job couldn't be queued, so the
 * caller can do the work itself: a Redis outage slows the app, it doesn't break it.
 */
@Injectable()
export class QueueService implements OnApplicationShutdown {
  private readonly log = new Logger(QueueService.name);
  private readonly queues = new Map<string, Queue>();
  private readonly workers: Worker[] = [];
  private readonly connections: Redis[] = [];
  /** Shared by the queues that add jobs. If it isn't up, jobs aren't queued and the caller does the work. */
  private readonly producer: Redis | null;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.producer = env.REDIS_URL ? this.connection({ enableOfflineQueue: false, maxRetriesPerRequest: 1 }) : null;
  }

  private connection(options: RedisOptions) {
    const conn = new Redis(this.env.REDIS_URL!, options);
    conn.on('error', (err: Error) => this.log.warn(`Queue Redis: ${err.message}`));
    this.connections.push(conn);
    return conn;
  }

  private queue(name: string) {
    let q = this.queues.get(name);
    if (!q) {
      q = new Queue(name, { connection: this.producer! });
      q.on('error', (err: Error) => this.log.warn(`Queue ${name}: ${err.message}`));
      this.queues.set(name, q);
    }
    return q;
  }

  /** What to do with this queue's jobs. Called once at startup by the service that owns them. */
  register<T>(name: string, handler: Handler<T>, concurrency: number) {
    if (!this.env.REDIS_URL || !this.env.RUN_WORKERS) return;
    const worker = new Worker<T>(name, (job) => handler(job.data), { connection: this.connection({ maxRetriesPerRequest: null }), concurrency });
    worker.on('error', (err: Error) => this.log.warn(`Worker ${name}: ${err.message}`));
    worker.on('failed', (job, err) => this.log.warn(`Job ${name}/${job?.id} failed: ${err.message}`));
    this.workers.push(worker);
  }

  async add<T>(name: string, data: T, options: JobsOptions = {}): Promise<boolean> {
    if (this.producer?.status !== 'ready') return false;
    try {
      const adding = this.queue(name).add(name, data, { removeOnComplete: true, removeOnFail: 200, ...options });
      await Promise.race([adding, timeout(ADD_TIMEOUT_MS)]);
      return true;
    } catch (err) {
      this.log.warn(`Couldn't queue ${name}: ${String(err)}`);
      return false;
    }
  }

  async onApplicationShutdown() {
    // Bounded: a Redis that's down mustn't hold up a restart.
    await Promise.race([
      Promise.allSettled([...this.workers.map((w) => w.close()), ...[...this.queues.values()].map((q) => q.close())]),
      timeout(SHUTDOWN_TIMEOUT_MS).catch(() => undefined),
    ]);
    for (const c of this.connections) c.disconnect();
  }
}
