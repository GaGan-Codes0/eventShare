import { randomInt, randomUUID } from 'node:crypto';

import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  DEFAULT_GUEST_PHOTO_LIMIT,
  HOST_PHOTO_LIMIT,
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  MAX_EVENT_IMAGE_BYTES,
  PHOTOGRAPHER_PHOTO_LIMIT,
  photoLimitFor,
  type ApiError,
  type CreateEventImageUploadInput,
  type CreateEventInput,
  type EventImageKind,
  type EventImageUpload,
  type EventDetail,
  type EventPreview,
  type EventRole,
  type EventSummary,
  type Member,
  type UpdateEventInput,
  type UpdateMemberInput,
} from '@eventshare/shared';
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import sharp from 'sharp';

import { DB, type Db } from '../db/db.module.js';
import { eventMembers, events, photos, users } from '../db/schema.js';
import { StorageService } from '../storage/storage.service.js';

type EventRow = typeof events.$inferSelect;

const IMAGE_EXTENSIONS: Record<CreateEventImageUploadInput['contentType'], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
type MemberRow = typeof eventMembers.$inferSelect;
/** The db itself or an open transaction. */
type Conn = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

export function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  return code;
}

@Injectable()
export class EventsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly storage: StorageService,
  ) {}

  /**
   * The authorization check every event-scoped route goes through.
   * Removed members and outsiders get a 404 (we don't reveal that the event exists).
   */
  async requireMember(eventId: string, userId: string): Promise<{ event: EventRow; role: EventRole; member: MemberRow }> {
    const [row] = await this.db
      .select({ event: events, role: eventMembers.role, member: eventMembers })
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
          guestPhotoLimit: input.guestPhotoLimit ?? DEFAULT_GUEST_PHOTO_LIMIT,
        })
        .returning();
      await tx.insert(eventMembers).values({ eventId: created.id, userId, role: 'host' });
      return created;
    });
    return this.detail(event.id, userId);
  }

  async listMine(userId: string): Promise<EventSummary[]> {
    const rows = await this.db
      .select({ event: events, member: eventMembers })
      .from(eventMembers)
      .innerJoin(events, eq(events.id, eventMembers.eventId))
      .where(and(eq(eventMembers.userId, userId), eq(eventMembers.status, 'active'), isNull(events.deletedAt)))
      .orderBy(desc(sql`coalesce(${events.startsAt}, ${events.createdAt})`));
    return Promise.all(rows.map((r) => this.toSummary(r.event, r.member)));
  }

  async detail(eventId: string, userId: string): Promise<EventDetail> {
    const { event, member } = await this.requireMember(eventId, userId);
    return {
      ...(await this.toSummary(event, member)),
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
      theme: event.theme,
      ...(await this.imageUrls(event)),
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
      .orderBy(desc(sql`${eventMembers.role} = 'host'`), desc(sql`${eventMembers.role} = 'photographer'`), eventMembers.joinedAt);
    return rows.map(({ m, u }) => ({
      userId: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      photosUsed: m.photosUsed,
    }));
  }

  async update(eventId: string, hostId: string, input: UpdateEventInput): Promise<EventDetail> {
    await this.requireHost(eventId, hostId);
    if (input.logoKey) await this.checkImage(eventId, 'logo', input.logoKey);
    if (input.posterKey) await this.checkImage(eventId, 'poster', input.posterKey);
    await this.db.update(events).set(input).where(eq(events.id, eventId));
    return this.detail(eventId, hostId);
  }

  /** Step 1 of a logo / poster change: a signed upload. Step 2 is PATCH with the key. */
  async createImageUpload(eventId: string, hostId: string, input: CreateEventImageUploadInput): Promise<EventImageUpload> {
    await this.requireHost(eventId, hostId);
    const key = `events/${eventId}/${input.kind}/${randomUUID()}.${IMAGE_EXTENSIONS[input.contentType]}`;
    const url = await this.storage.presignUpload(key, input.contentType, input.byteSize);
    return { key, upload: { url, headers: { 'Content-Type': input.contentType } } };
  }

  /** A key saved as the logo or poster must be this event's, uploaded, and really an image. */
  private async checkImage(eventId: string, kind: EventImageKind, key: string) {
    if (!key.startsWith(`events/${eventId}/${kind}/`) || key.includes('..')) {
      throw new BadRequestException(`That isn't an uploaded ${kind} for this event`);
    }
    const head = await this.storage.head(key);
    if (!head) throw new BadRequestException(`Upload the ${kind} first`);
    if (head.size > MAX_EVENT_IMAGE_BYTES) throw new BadRequestException(`The ${kind} is too big`);
    const meta = await sharp(await this.storage.read(key))
      .metadata()
      .catch(() => null);
    if (!meta?.width || !meta.height) throw new BadRequestException(`The ${kind} isn't an image`);
  }

  /** Host makes a guest the photographer, or back. Photos they already took stay theirs. */
  async setMemberRole(eventId: string, hostId: string, targetUserId: string, input: UpdateMemberInput): Promise<Member> {
    await this.requireHost(eventId, hostId);
    const updated = await this.db
      .update(eventMembers)
      .set({ role: input.role })
      .where(
        and(
          eq(eventMembers.eventId, eventId),
          eq(eventMembers.userId, targetUserId),
          eq(eventMembers.status, 'active'),
          sql`${eventMembers.role} <> 'host'`,
        ),
      )
      .returning();
    const member = updated.length ? (await this.members(eventId, hostId)).find((m) => m.userId === targetUserId) : undefined;
    if (!member) throw new NotFoundException('Not a guest in this event');
    return member;
  }

  /**
   * Takes one photo slot for this person, or refuses once they've used their allowance.
   * A single conditional UPDATE, so two uploads at the same moment can't both slip past the limit.
   */
  async reservePhotoSlot(conn: Conn, eventId: string, userId: string) {
    const limit = sql`CASE ${eventMembers.role}
      WHEN 'host' THEN ${HOST_PHOTO_LIMIT}::int
      WHEN 'photographer' THEN ${PHOTOGRAPHER_PHOTO_LIMIT}::int
      ELSE (SELECT ${events.guestPhotoLimit} FROM ${events} WHERE ${events.id} = ${eventId})
    END`;
    const reserved = await conn
      .update(eventMembers)
      .set({ photosUsed: sql`${eventMembers.photosUsed} + 1` })
      .where(
        and(
          eq(eventMembers.eventId, eventId),
          eq(eventMembers.userId, userId),
          eq(eventMembers.status, 'active'),
          sql`${eventMembers.photosUsed} < ${limit}`,
        ),
      )
      .returning({ photosUsed: eventMembers.photosUsed });
    if (reserved.length) return;

    const { event, member } = await this.requireMember(eventId, userId);
    const body: ApiError = {
      statusCode: 403,
      code: 'PHOTO_LIMIT_REACHED',
      message: `You've used all ${photoLimitFor(member.role, event.guestPhotoLimit)} of your photos for this event`,
    };
    throw new ForbiddenException(body);
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

  private async imageUrls(event: EventRow) {
    const [posterUrl, logoUrl] = await Promise.all(
      [event.posterKey, event.logoKey].map((key) => (key ? this.storage.presignDownload(key) : null)),
    );
    return { posterUrl, logoUrl };
  }

  private async toSummary(event: EventRow, member: MemberRow): Promise<EventSummary> {
    const shown = and(eq(photos.eventId, event.id), eq(photos.status, 'ready'), eq(photos.visibility, 'visible'), isNull(photos.deletedAt));
    const [p] = await this.db.select({ n: count() }).from(photos).where(shown);
    const { posterUrl, logoUrl } = await this.imageUrls(event);
    // Without a poster from the host, the newest photo is the event's cover.
    const [latest] = await this.db
      .select({ thumbKey: photos.thumbKey })
      .from(photos)
      .where(shown)
      .orderBy(desc(photos.createdAt))
      .limit(1);
    return {
      id: event.id,
      name: event.name,
      location: event.location,
      startsAt: event.startsAt?.toISOString() ?? null,
      coverUrl: posterUrl ?? (latest ? await this.storage.presignDownload(latest.thumbKey) : null),
      posterUrl,
      logoUrl,
      role: member.role,
      memberCount: await this.memberCount(event.id),
      photoCount: p?.n ?? 0,
      guestPhotoLimit: event.guestPhotoLimit,
      photoLimit: photoLimitFor(member.role, event.guestPhotoLimit),
      photosUsed: member.photosUsed,
      theme: event.theme,
    };
  }
}
