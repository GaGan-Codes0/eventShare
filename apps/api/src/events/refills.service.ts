import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { photoLimitFor, REFILL_RETRY_AFTER_MS, shootingPhase, type RefillRequest } from '@eventshare/shared';
import { and, asc, desc, eq, sql } from 'drizzle-orm';

import { DB, type Db } from '../db/db.module.js';
import { eventMembers, shotRefillRequests, users } from '../db/schema.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { EventsService } from './events.service.js';

/** Guests out of shots ask the hosts for more; the hosts give some, or say not now. */
@Injectable()
export class RefillsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly events: EventsService,
    private readonly realtime: RealtimeService,
  ) {}

  /** A guest asks. Asking again while waiting changes nothing. */
  async request(eventId: string, userId: string) {
    const { event, role } = await this.events.requireMember(eventId, userId);
    if (role !== 'member') throw new BadRequestException('Only guests have a roll to refill');
    if (event.guestPhotoLimit === null) throw new BadRequestException('This event has no shot limit');
    if (shootingPhase(role, event.startsAt) === 'closed') throw new BadRequestException('The camera has closed for this event');

    const [last] = await this.db
      .select({ status: shotRefillRequests.status, decidedAt: shotRefillRequests.decidedAt })
      .from(shotRefillRequests)
      .where(and(eq(shotRefillRequests.eventId, eventId), eq(shotRefillRequests.userId, userId)))
      .orderBy(desc(shotRefillRequests.createdAt))
      .limit(1);
    if (last?.status === 'declined' && last.decidedAt && Date.now() - last.decidedAt.getTime() < REFILL_RETRY_AFTER_MS) {
      throw new ConflictException('The hosts said not now. You can ask again a little later.');
    }
    const [created] = await this.db.insert(shotRefillRequests).values({ eventId, userId }).onConflictDoNothing().returning({ id: shotRefillRequests.id });
    if (created) await this.realtime.touch(eventId, 'refill');
  }

  /** Host: who's waiting, longest first. */
  async pending(eventId: string, hostId: string): Promise<RefillRequest[]> {
    const { event } = await this.events.requireHost(eventId, hostId);
    if (shootingPhase('host', event.startsAt) === 'closed') return []; // More shots couldn't be used now.
    const rows = await this.db
      .select({ request: shotRefillRequests, user: users, member: eventMembers })
      .from(shotRefillRequests)
      .innerJoin(users, eq(users.id, shotRefillRequests.userId))
      .innerJoin(eventMembers, and(eq(eventMembers.eventId, shotRefillRequests.eventId), eq(eventMembers.userId, shotRefillRequests.userId), eq(eventMembers.status, 'active')))
      .where(and(eq(shotRefillRequests.eventId, eventId), eq(shotRefillRequests.status, 'pending')))
      .orderBy(asc(shotRefillRequests.createdAt));
    return rows.map(({ request, user, member }) => ({
      id: request.id,
      userId: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      photosUsed: member.photosUsed,
      photoLimit: photoLimitFor(member.role, event.guestPhotoLimit, member.bonusShots),
      requestedAt: request.createdAt.toISOString(),
    }));
  }

  /** Host: gives this many shots, or (null) says not now. Answering twice gives shots only once. */
  async decide(eventId: string, hostId: string, requestId: string, shots: number | null) {
    await this.events.requireHost(eventId, hostId);
    await this.db.transaction(async (tx) => {
      const [answered] = await tx
        .update(shotRefillRequests)
        .set({ status: shots === null ? 'declined' : 'approved', shots, decidedAt: new Date() })
        .where(and(eq(shotRefillRequests.id, requestId), eq(shotRefillRequests.eventId, eventId), eq(shotRefillRequests.status, 'pending')))
        .returning();
      if (!answered) throw new NotFoundException('That request has already been answered');
      if (shots !== null) {
        await tx
          .update(eventMembers)
          .set({ bonusShots: sql`${eventMembers.bonusShots} + ${shots}` })
          .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, answered.userId)));
      }
    });
    await this.realtime.touch(eventId, 'refill');
  }
}
