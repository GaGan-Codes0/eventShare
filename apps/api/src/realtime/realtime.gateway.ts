import type { Server } from 'node:http';

import { Inject, Injectable, Logger, type BeforeApplicationShutdown } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { WebSocket, WebSocketServer } from 'ws';
import { z } from 'zod';

import { AuthService } from '../auth/auth.service.js';
import { DB, type Db } from '../db/db.module.js';
import { users } from '../db/schema.js';
import { EventsService } from '../events/events.service.js';
import { RealtimeService } from './realtime.service.js';

const AUTH_TIMEOUT_MS = 10_000;
const PING_MS = 30_000;

const messageSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('auth'), token: z.string().min(1).max(4096) }),
  z.object({ t: z.literal('watch'), eventId: z.uuid() }),
]);

type Client = WebSocket & { userId?: string; eventId?: string; alive?: boolean };

/**
 * Live updates at /realtime. The phone signs in with its first message (a token in the URL would
 * end up in logs), then watches one event. Only counters are sent, never photos, so a removed
 * guest learns nothing from a connection left open.
 */
@Injectable()
export class RealtimeGateway implements BeforeApplicationShutdown {
  private readonly log = new Logger(RealtimeGateway.name);
  private readonly wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 });
  private readonly watching = new Map<string, Set<Client>>();
  private pinger?: ReturnType<typeof setInterval>;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly auth: AuthService,
    private readonly events: EventsService,
    private readonly realtime: RealtimeService,
  ) {}

  attach(server: Server) {
    server.on('upgrade', (req, socket, head) => {
      if (new URL(req.url ?? '', 'http://x').pathname !== '/realtime') return socket.destroy();
      this.wss.handleUpgrade(req, socket, head, (ws) => this.connected(ws));
    });
    this.realtime.onUpdate((eventId, live) => {
      const message = JSON.stringify({ t: 'live', eventId, live });
      for (const client of this.watching.get(eventId) ?? []) if (client.readyState === WebSocket.OPEN) client.send(message);
    });
    // Drops phones that vanished without saying goodbye.
    this.pinger = setInterval(() => {
      for (const c of this.wss.clients as Set<Client>) {
        if (c.alive === false) c.terminate();
        else {
          c.alive = false;
          c.ping();
        }
      }
    }, PING_MS);
    this.pinger.unref();
  }

  private connected(client: Client) {
    client.alive = true;
    client.on('pong', () => (client.alive = true));
    client.on('error', () => client.terminate());
    const authTimer = setTimeout(() => client.userId || client.close(4401, 'auth required'), AUTH_TIMEOUT_MS);
    client.on('close', () => {
      clearTimeout(authTimer);
      this.unwatch(client);
    });
    // One at a time and in order: "watch" must not overtake a sign-in that's still being checked.
    let turn: Promise<unknown> = Promise.resolve();
    client.on('message', (raw) => {
      turn = turn.then(() => this.handle(client, raw.toString())).catch((err: unknown) => this.log.warn(`Realtime: ${String(err)}`));
    });
  }

  private async handle(client: Client, raw: string) {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return client.close(4400, 'bad message');
    }
    const parsed = messageSchema.safeParse(json);
    if (!parsed.success) return client.close(4400, 'bad message');
    const message = parsed.data;

    if (message.t === 'auth') {
      const userId = await this.auth.verifyToken(message.token).catch(() => null);
      const user = userId && (await this.db.query.users.findFirst({ where: and(eq(users.id, userId), isNull(users.deletedAt)) }));
      if (!user) return client.close(4401, 'invalid token');
      client.userId = user.id;
      return;
    }

    if (!client.userId) return client.close(4401, 'auth required');
    const member = await this.events.requireMember(message.eventId, client.userId).catch(() => null);
    if (!member) return client.close(4403, 'not a member');
    this.unwatch(client);
    client.eventId = message.eventId;
    let set = this.watching.get(message.eventId);
    if (!set) this.watching.set(message.eventId, (set = new Set()));
    set.add(client);
    // Where things stand now, so a phone that reconnects catches up.
    client.send(JSON.stringify({ t: 'live', eventId: message.eventId, live: await this.realtime.current(message.eventId) }));
  }

  private unwatch(client: Client) {
    if (!client.eventId) return;
    const set = this.watching.get(client.eventId);
    set?.delete(client);
    if (set?.size === 0) this.watching.delete(client.eventId);
    client.eventId = undefined;
  }

  /** Before the HTTP server closes: it waits for open connections, and these never end by themselves. */
  beforeApplicationShutdown() {
    clearInterval(this.pinger);
    for (const c of this.wss.clients) c.terminate();
    this.wss.close();
  }
}
