import { randomInt } from 'node:crypto';

import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  type CreateEventInput,
  type EventDetail,
  type EventPreview,
  type EventRole,
  type EventSummary,
  type Member,
} from '@eventshare/shared';
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';

import { DB, type Db } from '../db/db.module.js';
import { eventMembers, events, photos, users } from '../db/schema.js';

type EventRow = typeof events.$inferSelect;

export function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  return code;
}

@Injectable()
export class EventsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * The authorization check every event-scoped route goes through.
   * Removed members and outsiders get a 404 (we don't reveal that the event exists).
   */
  async requireMember(eventId: string, userId: string): Promise<{ event: EventRow; role: EventRole }> {
    const [row] = await this.db
      .select({ event: events, role: eventMembers.role })
      .from(eventMembers)
      .innerJoin(events, eq(events.id, eventMembers.eventId))
      .where(
        and(
          eq(eventMembers.eventId, eventId),
          eq(eventMembers.userId, userId),
          eq(eventMembers.status, 'active'),
          isNull(events.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException('Event not found');
    return row;
  }

  async requireHost(eventId: string, userId: string) {
    const m = await this.requireMember(eventId, userId);
    if (m.role !== 'host') throw new ForbiddenException('Only the host can do that');
    return m;
  }

  async create(userId: string, input: CreateEventInput): Promise<EventDetail> {
    const event = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(events)
        .values({
          ownerId: userId,
          name: input.name,
          location: input.location || null,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          joinCode: generateJoinCode(),
        })
        .returning();
      await tx.insert(eventMembers).values({ eventId: created.id, userId, role: 'host' });
      return created;
    });
    return this.detail(event.id, userId);
  }

  async listMine(userId: string): Promise<EventSummary[]> {
    const rows = await this.db
      .select({ event: events, role: eventMembers.role })
      .from(eventMembers)
      .innerJoin(events, eq(events.id, eventMembers.eventId))
      .where(and(eq(eventMembers.userId, userId), eq(eventMembers.status, 'active'), isNull(events.deletedAt)))
      .orderBy(desc(sql`coalesce(${events.startsAt}, ${events.createdAt})`));
    return Promise.all(rows.map((r) => this.toSummary(r.event, r.role)));
  }

  async detail(eventId: string, userId: string): Promise<EventDetail> {
    const { event, role } = await this.requireMember(eventId, userId);
    return {
      ...(await this.toSummary(event, role)),
      joinCode: event.joinCode,
      ownerId: event.ownerId,
      createdAt: event.createdAt.toISOString(),
    };
  }

  private async findByCode(code: string) {
    const event = await this.db.query.events.findFirst({
      where: and(eq(events.joinCode, code), isNull(events.deletedAt)),
    });
    if (!event) throw new NotFoundException("That code doesn't match an event");
    return event;
  }

  async preview(code: string): Promise<EventPreview> {
    const event = await this.findByCode(code);
    const host = await this.db.query.users.findFirst({ where: eq(users.id, event.ownerId) });
    return {
      name: event.name,
      location: event.location,
      startsAt: event.startsAt?.toISOString() ?? null,
      hostName: host?.name ?? 'Your host',
      memberCount: await this.memberCount(event.id),
    };
  }

  async join(userId: string, code: string): Promise<EventDetail> {
    const event = await this.findByCode(code);
    const existing = await this.db.query.eventMembers.findFirst({
      where: and(eq(eventMembers.eventId, event.id), eq(eventMembers.userId, userId)),
    });
    if (existing?.status === 'removed') {
      throw new ForbiddenException('The host removed you from this event');
    }
    if (!existing) {
      await this.db.insert(eventMembers).values({ eventId: event.id, userId, role: 'member' }).onConflictDoNothing();
    }
    return this.detail(event.id, userId);
  }

  async members(eventId: string, userId: string): Promise<Member[]> {
    await this.requireMember(eventId, userId);
    const rows = await this.db
      .select({ m: eventMembers, u: users })
      .from(eventMembers)
      .innerJoin(users, eq(users.id, eventMembers.userId))
      .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.status, 'active')))
      .orderBy(desc(sql`${eventMembers.role} = 'host'`), eventMembers.joinedAt);
    return rows.map(({ m, u }) => ({
      userId: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    }));
  }

  async removeMember(eventId: string, hostId: string, targetUserId: string) {
    const { event } = await this.requireHost(eventId, hostId);
    if (targetUserId === event.ownerId) throw new BadRequestException("The event's creator can't be removed");
    const updated = await this.db
      .update(eventMembers)
      .set({ status: 'removed', removedAt: new Date() })
      .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, targetUserId), eq(eventMembers.status, 'active')))
      .returning();
    if (updated.length === 0) throw new NotFoundException('Not a member of this event');
  }

  async rotateCode(eventId: string, hostId: string): Promise<EventDetail> {
    await this.requireHost(eventId, hostId);
    await this.db.update(events).set({ joinCode: generateJoinCode() }).where(eq(events.id, eventId));
    return this.detail(eventId, hostId);
  }

  private async memberCount(eventId: string) {
    const [r] = await this.db
      .select({ n: count() })
      .from(eventMembers)
      .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.status, 'active')));
    return r?.n ?? 0;
  }

  private async toSummary(event: EventRow, role: EventRole): Promise<EventSummary> {
    const [p] = await this.db
      .select({ n: count() })
      .from(photos)
      .where(and(eq(photos.eventId, event.id), eq(photos.status, 'ready'), eq(photos.visibility, 'visible'), isNull(photos.deletedAt)));
    return {
      id: event.id,
      name: event.name,
      location: event.location,
      startsAt: event.startsAt?.toISOString() ?? null,
      coverUrl: null,
      role,
      memberCount: await this.memberCount(event.id),
      photoCount: p?.n ?? 0,
    };
  }
}
