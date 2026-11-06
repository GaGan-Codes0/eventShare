import { randomInt, randomUUID } from 'node:crypto';

import {
  ConflictException,
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
  MAX_PHOTOGRAPHERS,
  PHOTOGRAPHER_PHOTO_LIMIT,
  photoLimitFor,
  VIDEO_LIMIT_MS,
  VOICE_LIMIT_MS,
  type ApiError,
  type CreateEventImageUploadInput,
  type CreateEventData,
  type EventImageKind,
  type EventImageUpload,
  type EventDetail,
  type EventPreview,
  type EventRole,
  type EventSummary,
  type InvitePhotographerData,
  type InvitePhotographerResult,
  type Member,
  type PhotographerInvite,
  type EventIdentity,
  type EventRules,
  type UpdateEventData,
  type UpdateMemberInput,
} from '@eventshare/shared';
import { and, count, desc, eq, isNotNull, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import sharp from 'sharp';

import { DB, type Db } from '../db/db.module.js';
import { eventMembers, events, photographerInvites, photos, users } from '../db/schema.js';
import { MailService } from '../mail/mail.service.js';
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

/** "Tanya & Paul" for a wedding with both names, else the title. */
export function displayName(e: Pick<EventRow, 'type' | 'name' | 'partner1' | 'partner2' | 'joiner'>) {
  return e.type === 'wedding' && e.partner1 && e.partner2 ? `${e.partner1} ${e.joiner} ${e.partner2}` : e.name;
}

/** Guests see each other's photos once the album opens. The host always sees everything. */
export function albumOpen(event: Pick<EventRow, 'albumOpensAt'>, role: EventRole) {
  return role === 'host' || !event.albumOpensAt || event.albumOpensAt.getTime() <= Date.now();
}

/**
 * Which photos of an event this person may see: the host sees all. Others never see hidden
 * photos; they see their own (even while waiting for review or before the album opens), and
 * everyone else's approved ones once the album is open.
 */
export function visibleTo(event: Pick<EventRow, 'id' | 'albumOpensAt'>, role: EventRole, userId: string): SQL {
  const base = and(eq(photos.eventId, event.id), eq(photos.status, 'ready'), isNull(photos.deletedAt))!;
  if (role === 'host') return base;
  const others = albumOpen(event, role) ? eq(photos.pendingReview, false) : sql`false`;
  return and(base, eq(photos.visibility, 'visible'), or(eq(photos.uploaderId, userId), others))!;
}

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
    private readonly mail: MailService,
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

  async create(userId: string, input: CreateEventData): Promise<EventDetail> {
    const event = await this.db.transaction(async (tx) => {
      const fields = {
        type: input.type,
        name: input.name ?? '',
        partner1: input.partner1 || null,
        partner2: input.partner2 || null,
        joiner: input.joiner,
      };
      const [created] = await tx
        .insert(events)
        .values({
          ownerId: userId,
          ...fields,
          name: displayName(fields),
          organizer: input.organizer ?? null,
          tagline: input.tagline ?? null,
          location: input.location || null,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          joinCode: generateJoinCode(),
          guestPhotoLimit: input.guestPhotoLimit === undefined ? DEFAULT_GUEST_PHOTO_LIMIT : input.guestPhotoLimit,
          revealMode: input.revealMode ?? 'live',
          albumOpensAt: input.albumOpensAt ? new Date(input.albumOpensAt) : null,
          theme: input.theme ?? null,
          prompts: input.prompts ?? [],
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
    const shooters = await this.db
      .select({ name: users.name })
      .from(eventMembers)
      .innerJoin(users, eq(users.id, eventMembers.userId))
      .where(and(eq(eventMembers.eventId, event.id), eq(eventMembers.role, 'photographer'), eq(eventMembers.status, 'active')));
    return {
      ...(await this.identity(event)),
      hostName: host?.name ?? 'Your host',
      memberCount: await this.memberCount(event.id),
      guestPhotoLimit: event.guestPhotoLimit,
      photographers: shooters.map((s) => s.name.split(' ')[0] ?? s.name),
      revealMode: event.revealMode,
      albumOpensAt: event.albumOpensAt?.toISOString() ?? null,
      requireReview: event.requireReview,
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
    // Invited by email to shoot this event: they come in as the photographer.
    await this.claimInvite(event.id, userId);
    return this.detail(event.id, userId);
  }

  async members(eventId: string, userId: string): Promise<Member[]> {
    const { role } = await this.requireMember(eventId, userId);
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
      ...(role === 'host' && { email: u.email }),
    }));
  }

  async update(eventId: string, hostId: string, input: UpdateEventData): Promise<EventDetail> {
    const { event } = await this.requireHost(eventId, hostId);
    if (input.logoKey) await this.checkImage(eventId, 'logo', input.logoKey);
    if (input.posterKey) await this.checkImage(eventId, 'poster', input.posterKey);
    const { startsAt, albumOpensAt, ...rest } = input;
    const next = { ...event, ...rest };
    if (next.type === 'wedding' && (!next.partner1 || !next.partner2)) throw new BadRequestException('Add both names');
    await this.db
      .update(events)
      .set({
        ...rest,
        ...(startsAt !== undefined && { startsAt: startsAt ? new Date(startsAt) : null }),
        ...(albumOpensAt !== undefined && { albumOpensAt: albumOpensAt ? new Date(albumOpensAt) : null }),
        // Going back to live opens the album now.
        ...(input.revealMode === 'live' && { albumOpensAt: null }),
        name: displayName(next),
      })
      .where(eq(events.id, eventId));
    // The old picture isn't used anywhere once replaced or removed: delete it, without making the host wait.
    for (const [old, now] of [
      [event.logoKey, input.logoKey],
      [event.posterKey, input.posterKey],
    ] as const) {
      if (now !== undefined && old && old !== now) void this.storage.delete(old).catch(() => undefined);
    }
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
    const target = await this.db.query.users.findFirst({ where: eq(users.id, targetUserId) });
    if (input.role === 'photographer') {
      // Their own open invite (if any) is the slot they're taking, so it doesn't count twice.
      if ((await this.slotsUsed(eventId, targetUserId, target?.email ?? undefined)) >= MAX_PHOTOGRAPHERS) this.slotsFull();
    }
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
    // Picked from the guests after being invited by email: that invite is done.
    if (input.role === 'photographer' && target?.email) await this.closeInvite(eventId, target.email, targetUserId);
    return member;
  }

  /**
   * Photographer slots in use: active photographers plus open email invites. A person being
   * promoted (and their own invite) can be left out, so they don't count against themselves.
   */
  private async slotsUsed(eventId: string, exceptUserId?: string, exceptEmail?: string) {
    const [[shooters], [invites]] = await Promise.all([
      this.db
        .select({ n: count() })
        .from(eventMembers)
        .where(
          and(
            eq(eventMembers.eventId, eventId),
            eq(eventMembers.role, 'photographer'),
            eq(eventMembers.status, 'active'),
            ...(exceptUserId ? [ne(eventMembers.userId, exceptUserId)] : []),
          ),
        ),
      this.db
        .select({ n: count() })
        .from(photographerInvites)
        .where(and(this.openInvites(eventId), ...(exceptEmail ? [ne(photographerInvites.email, exceptEmail)] : []))),
    ]);
    return (shooters?.n ?? 0) + (invites?.n ?? 0);
  }

  private openInvites(eventId: string) {
    return and(eq(photographerInvites.eventId, eventId), isNull(photographerInvites.acceptedAt), isNull(photographerInvites.cancelledAt));
  }

  private slotsFull(): never {
    const body: ApiError = {
      statusCode: 409,
      code: 'PHOTOGRAPHER_SLOTS_FULL',
      message: `All ${MAX_PHOTOGRAPHERS} photographer slots are taken. Remove one first.`,
    };
    throw new ConflictException(body);
  }

  private toInvite(row: typeof photographerInvites.$inferSelect): PhotographerInvite {
    return { id: row.id, name: row.name, email: row.email, invitedAt: row.createdAt.toISOString(), emailed: Boolean(row.emailedAt) };
  }

  /** Host: the email invites still waiting to be taken up ("Invite sent"). */
  async photographerInvites(eventId: string, hostId: string): Promise<PhotographerInvite[]> {
    await this.requireHost(eventId, hostId);
    const rows = await this.db.select().from(photographerInvites).where(this.openInvites(eventId)).orderBy(photographerInvites.createdAt);
    return rows.map((r) => this.toInvite(r));
  }

  /**
   * Host invites someone by email to shoot the event. It takes a photographer slot right away;
   * if that email is already in the event, they become the photographer now.
   * (The invite email itself comes later: for now the host shares the code with them.)
   */
  async invitePhotographer(eventId: string, hostId: string, input: InvitePhotographerData): Promise<InvitePhotographerResult> {
    const { event } = await this.requireHost(eventId, hostId);
    const host = await this.db.query.users.findFirst({ where: eq(users.id, hostId) });
    if (host?.email === input.email) throw new BadRequestException("That's your own email. You're already the host.");

    const [open] = await this.db
      .select({ id: photographerInvites.id })
      .from(photographerInvites)
      .where(and(this.openInvites(eventId), eq(photographerInvites.email, input.email)))
      .limit(1);
    if (open) throw new ConflictException(`${input.email} already has an invite`);

    const user = await this.db.query.users.findFirst({ where: eq(users.email, input.email) });
    const member = user
      ? await this.db.query.eventMembers.findFirst({
          where: and(eq(eventMembers.eventId, event.id), eq(eventMembers.userId, user.id), eq(eventMembers.status, 'active')),
        })
      : undefined;
    if (user && member) {
      if (member.role === 'photographer') throw new ConflictException(`${user.name} is already a photographer`);
      if (member.role === 'host') throw new BadRequestException(`${user.name} is a host of this event`);
      return { status: 'joined', member: await this.setMemberRole(eventId, hostId, user.id, { role: 'photographer' }) };
    }

    if ((await this.slotsUsed(eventId)) >= MAX_PHOTOGRAPHERS) this.slotsFull();
    try {
      const [row] = await this.db
        .insert(photographerInvites)
        .values({ eventId, name: input.name, email: input.email, invitedBy: hostId })
        .returning();
      const sent = await this.mail.photographerInvite({
        to: input.email,
        name: input.name,
        hostName: host?.name ?? 'Your host',
        eventName: event.name,
        eventKind: event.type === 'wedding' ? 'the wedding of' : '',
        joinCode: event.joinCode,
        dateLabel: event.startsAt
          ? event.startsAt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
          : null,
      });
      if (!sent) return { status: 'invited', invite: this.toInvite(row) };
      const [emailed] = await this.db.update(photographerInvites).set({ emailedAt: new Date() }).where(eq(photographerInvites.id, row.id)).returning();
      return { status: 'invited', invite: this.toInvite(emailed) };
    } catch (err) {
      // Two invites to the same email at the same moment: the unique index keeps one.
      if ((err as { code?: string }).code === '23505') throw new ConflictException(`${input.email} already has an invite`);
      throw err;
    }
  }

  /** Host withdraws an invite; its slot frees up. */
  async cancelPhotographerInvite(eventId: string, hostId: string, inviteId: string) {
    await this.requireHost(eventId, hostId);
    const updated = await this.db
      .update(photographerInvites)
      .set({ cancelledAt: new Date() })
      .where(and(eq(photographerInvites.id, inviteId), this.openInvites(eventId)))
      .returning({ id: photographerInvites.id });
    if (updated.length === 0) throw new NotFoundException('Invite not found');
  }

  /** On joining: an open invite for this person's email makes them the photographer. */
  private async claimInvite(eventId: string, userId: string) {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user?.email) return;
    const [invite] = await this.db
      .select({ id: photographerInvites.id })
      .from(photographerInvites)
      .where(and(this.openInvites(eventId), eq(photographerInvites.email, user.email)))
      .limit(1);
    if (!invite) return;
    // The invite already holds the slot, so no limit check here. Hosts stay hosts.
    await this.db
      .update(eventMembers)
      .set({ role: 'photographer' })
      .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, userId), eq(eventMembers.status, 'active'), eq(eventMembers.role, 'member')));
    await this.closeInvite(eventId, user.email, userId);
  }

  private async closeInvite(eventId: string, email: string, userId: string) {
    await this.db
      .update(photographerInvites)
      .set({ acceptedBy: userId, acceptedAt: new Date() })
      .where(and(this.openInvites(eventId), eq(photographerInvites.email, email)));
  }

  /**
   * Takes one photo slot for this person, or refuses once they've used their allowance.
   * A single conditional UPDATE, so two uploads at the same moment can't both slip past the limit.
   */
  async reservePhotoSlot(conn: Conn, eventId: string, userId: string) {
    const limit = sql`CASE ${eventMembers.role}
      WHEN 'host' THEN ${HOST_PHOTO_LIMIT}::int
      WHEN 'photographer' THEN ${PHOTOGRAPHER_PHOTO_LIMIT}::int
      ELSE coalesce((SELECT ${events.guestPhotoLimit} FROM ${events} WHERE ${events.id} = ${eventId}), 2147483647)
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
      message: `You've used all ${photoLimitFor(member.role, event.guestPhotoLimit) ?? 0} of your photos for this event`,
    };
    throw new ForbiddenException(body);
  }

  /**
   * Takes `ms` of this person's video or voice time, or refuses if that would go past their
   * limit. Like reservePhotoSlot, one conditional UPDATE, so concurrent uploads can't overshoot.
   * A negative `ms` gives time back (a recording turned out shorter than reserved).
   */
  async reserveMediaTime(conn: Conn, eventId: string, userId: string, kind: 'video' | 'voice', ms: number) {
    const column = kind === 'video' ? eventMembers.videoMsUsed : eventMembers.voiceMsUsed;
    const limit = kind === 'video' ? VIDEO_LIMIT_MS : VOICE_LIMIT_MS;
    const next = sql`greatest(0, ${column} + ${ms}::int)`;
    const reserved = await conn
      .update(eventMembers)
      .set(kind === 'video' ? { videoMsUsed: next } : { voiceMsUsed: next })
      .where(
        and(
          eq(eventMembers.eventId, eventId),
          eq(eventMembers.userId, userId),
          eq(eventMembers.status, 'active'),
          ms > 0 ? sql`${column} + ${ms}::int <= ${limit}::int` : sql`true`,
        ),
      )
      .returning({ used: column });
    if (reserved.length) return;

    const { member } = await this.requireMember(eventId, userId);
    const used = kind === 'video' ? member.videoMsUsed : member.voiceMsUsed;
    const left = Math.max(0, limit - used);
    const fmt = (t: number) => `${Math.floor(t / 60_000)}:${String(Math.floor((t % 60_000) / 1000)).padStart(2, '0')}`;
    const body: ApiError = {
      statusCode: 403,
      code: kind === 'video' ? 'VIDEO_LIMIT_REACHED' : 'VOICE_LIMIT_REACHED',
      message:
        left === 0
          ? `You've used all ${fmt(limit)} of your ${kind === 'video' ? 'video' : 'voice-note'} time for this event`
          : `That's longer than the ${fmt(left)} of ${kind === 'video' ? 'video' : 'voice-note'} time you have left`,
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

  private async identity(event: EventRow): Promise<EventIdentity> {
    return {
      name: event.name,
      type: event.type,
      partner1: event.partner1,
      partner2: event.partner2,
      joiner: event.joiner,
      organizer: event.organizer,
      tagline: event.tagline,
      location: event.location,
      startsAt: event.startsAt?.toISOString() ?? null,
      theme: event.theme,
      ...(await this.imageUrls(event)),
    };
  }

  private rules(event: EventRow, role: EventRole): EventRules {
    return {
      guestPhotoLimit: event.guestPhotoLimit,
      revealMode: event.revealMode,
      albumOpensAt: event.albumOpensAt?.toISOString() ?? null,
      albumOpen: albumOpen(event, role),
      requireReview: event.requireReview,
      allowDownloads: event.allowDownloads,
      allowLibraryUploads: event.allowLibraryUploads,
      dateStamp: event.dateStamp,
      filter: event.filter,
      prompts: event.prompts,
    };
  }

  private async toSummary(event: EventRow, member: MemberRow): Promise<EventSummary> {
    const identity = await this.identity(event);
    // Counts are of the shared album: visible, approved, finished photos.
    const shared = and(
      eq(photos.eventId, event.id),
      eq(photos.status, 'ready'),
      eq(photos.visibility, 'visible'),
      eq(photos.pendingReview, false),
      isNull(photos.deletedAt),
    );
    const [[p], [pending], slots, memberCount] = await Promise.all([
      this.db.select({ n: count() }).from(photos).where(shared),
      member.role === 'host'
        ? this.db
            .select({ n: count() })
            .from(photos)
            .where(and(eq(photos.eventId, event.id), eq(photos.pendingReview, true), isNull(photos.deletedAt)))
        : Promise.resolve([{ n: 0 }]),
      this.slotsUsed(event.id),
      this.memberCount(event.id),
    ]);
    // Without a poster from the host, the newest photo you can see is the cover.
    const [latest] = await this.db
      .select({ thumbKey: photos.thumbKey })
      .from(photos)
      .where(and(visibleTo(event, member.role, member.userId), eq(photos.visibility, 'visible'), isNotNull(photos.thumbKey)))
      .orderBy(desc(photos.createdAt))
      .limit(1);
    return {
      ...identity,
      ...this.rules(event, member.role),
      id: event.id,
      coverUrl: identity.posterUrl ?? (latest?.thumbKey ? await this.storage.presignDownload(latest.thumbKey) : null),
      role: member.role,
      memberCount,
      // Slots taken, open email invites included (as the prototype counts them).
      photographerCount: slots,
      photoCount: p?.n ?? 0,
      pendingReviewCount: pending?.n ?? 0,
      photoLimit: photoLimitFor(member.role, event.guestPhotoLimit),
      photosUsed: member.photosUsed,
      videoLimitMs: VIDEO_LIMIT_MS,
      videoMsUsed: member.videoMsUsed,
      voiceLimitMs: VOICE_LIMIT_MS,
      voiceMsUsed: member.voiceMsUsed,
    };
  }
}
