import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PHOTO_PAGE_SIZE,
  type ApiError,
  type CreateUploadInput,
  type EventRole,
  type MediaKind,
  type Page,
  type Photo,
  type PhotoLikes,
  type PhotoListFilter,
  type UpdatePhotoInput,
  type UploadTicket,
} from '@eventshare/shared';
import { and, count, desc, eq, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import sharp from 'sharp';

import { DB, type Db } from '../db/db.module.js';
import { eventMembers, photoLikes, photos, users } from '../db/schema.js';
import { albumOpen, EventsService, visibleTo } from '../events/events.service.js';
import { FacesService } from '../faces/faces.service.js';
import { mediaDurationMs } from '../media/duration.js';
import { StorageService } from '../storage/storage.service.js';

type PhotoRow = typeof photos.$inferSelect;
type CreateUploadData = Omit<CreateUploadInput, 'source' | 'kind'> & { source: 'camera' | 'library'; kind: MediaKind };
/** What a photo's card needs besides the row: who took it and its likes, as seen by the viewer. */
type PhotoExtras = { uploaderName: string; uploaderRole: EventRole; likeCount: number; likedByMe: boolean };

function forbidden(code: ApiError['code'], message: string) {
  const body: ApiError = { statusCode: 403, code, message };
  return new ForbiddenException(body);
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
};

/** The phone's own measurement may be off by a frame or two; past this the file's length wins. */
const DURATION_SLACK_MS = 1000;

function encodeCursor(row: { createdAt: Date; id: string }) {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`).toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  const [iso, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const createdAt = new Date(iso ?? '');
  if (!id || Number.isNaN(createdAt.getTime())) throw new BadRequestException('Bad cursor');
  return { createdAt, id };
}

/** Rolls back a photo-slot reservation when a concurrent retry already created the row. */
class LostRace extends Error {}

@Injectable()
export class PhotosService {
  private readonly log = new Logger(PhotosService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly events: EventsService,
    private readonly storage: StorageService,
    private readonly faces: FacesService,
  ) {}

  /**
   * Step 1 of an upload. Idempotent per (uploader, clientUploadId): a retry gets the same
   * photo back, and once it's complete there is nothing left to upload.
   */
  async createUpload(eventId: string, userId: string, input: CreateUploadData): Promise<UploadTicket> {
    const { event, role } = await this.events.requireMember(eventId, userId);
    if (input.source === 'library' && role === 'member' && !event.allowLibraryUploads) {
      throw forbidden('LIBRARY_UPLOADS_OFF', 'The hosts turned off camera-roll uploads for this event');
    }

    let row = await this.db.query.photos.findFirst({
      where: and(eq(photos.uploaderId, userId), eq(photos.clientUploadId, input.clientUploadId)),
    });
    if (row && row.eventId !== eventId) throw new ConflictException('Upload id already used for another event');

    if (!row) {
      const id = crypto.randomUUID();
      const base = `events/${eventId}/photos/${id}`;
      // A new photo takes one slot of the uploader's allowance, a video or voice note its length
      // of their time; retries of it (found above) don't.
      row = await this.db
        .transaction(async (tx) => {
          if (input.kind === 'photo') await this.events.reservePhotoSlot(tx, eventId, userId);
          else await this.events.reserveMediaTime(tx, eventId, userId, input.kind, input.durationMs ?? 0);
          const [created] = await tx
            .insert(photos)
            .values({
              id,
              eventId,
              uploaderId: userId,
              clientUploadId: input.clientUploadId,
              storageKey: `${base}/original.${EXTENSIONS[input.contentType]}`,
              thumbKey: input.kind === 'voice' ? null : `${base}/thumb.jpg`,
              kind: input.kind,
              durationMs: input.kind === 'photo' ? null : (input.durationMs ?? null),
              contentType: input.contentType,
              byteSize: input.byteSize,
              width: input.width,
              height: input.height,
              takenAt: input.takenAt ? new Date(input.takenAt) : null,
              // Guest photos wait for the host when the event asks for review; photographers skip the queue.
              pendingReview: event.requireReview && role === 'member',
              prompt: input.prompt ?? null,
            })
            .onConflictDoNothing()
            .returning();
          // A concurrent retry of the same photo created it first: roll back to hand the slot back.
          if (!created) throw new LostRace();
          return created;
        })
        .catch((err: unknown) => {
          if (err instanceof LostRace) return undefined;
          throw err;
        });
      // Lost a race with a concurrent retry: use the row it created.
      row ??= await this.db.query.photos.findFirst({
        where: and(eq(photos.uploaderId, userId), eq(photos.clientUploadId, input.clientUploadId)),
      });
      if (!row) throw new ConflictException('Please retry');
    }

    if (row.status === 'ready') return { photoId: row.id, status: row.status, original: null, thumb: null };

    const [originalUrl, thumbUrl] = await Promise.all([
      this.storage.presignUpload(row.storageKey, row.contentType, row.byteSize),
      row.thumbKey && input.thumbByteSize ? this.storage.presignUpload(row.thumbKey, 'image/jpeg', input.thumbByteSize) : null,
    ]);
    return {
      photoId: row.id,
      status: row.status,
      original: { url: originalUrl, headers: { 'Content-Type': row.contentType } },
      thumb: thumbUrl ? { url: thumbUrl, headers: { 'Content-Type': 'image/jpeg' } } : null,
    };
  }

  /** Step 2: the phone says both files are uploaded. We verify before showing it to anyone. */
  async complete(photoId: string, userId: string): Promise<Photo> {
    const row = await this.db.query.photos.findFirst({ where: and(eq(photos.id, photoId), isNull(photos.deletedAt)) });
    if (!row || row.uploaderId !== userId) throw new NotFoundException('Photo not found');
    await this.events.requireMember(row.eventId, userId);
    if (row.status === 'ready') return this.dtoFor(row, userId);

    const [original, thumb] = await Promise.all([
      this.storage.head(row.storageKey),
      row.thumbKey ? this.storage.head(row.thumbKey) : Promise.resolve(null),
    ]);
    if (!original || (row.thumbKey && !thumb)) throw new BadRequestException('Upload not finished');
    if (original.size !== row.byteSize) {
      await this.setStatus(row.id, 'failed');
      throw new BadRequestException('Uploaded file size does not match');
    }

    // The thumbnail is small: decode it to make sure it really is an image.
    if (row.thumbKey) {
      try {
        const meta = await sharp(await this.storage.read(row.thumbKey)).metadata();
        if (!meta.width || !meta.height) throw new Error('no dimensions');
      } catch (err) {
        this.log.warn(`Invalid thumbnail for photo ${row.id}: ${String(err)}`);
        await this.setStatus(row.id, 'failed');
        throw new BadRequestException('Preview image is invalid');
      }
    }

    const durationMs = row.kind === 'photo' ? null : await this.checkDuration(row);
    const [ready] = await this.db.update(photos).set({ status: 'ready', durationMs }).where(eq(photos.id, row.id)).returning();
    return this.dtoFor(ready, userId);
  }

  /**
   * A video or voice note's true length, from the file. Time was reserved for the length the
   * phone reported: give back what it overstated, take what it understated (refusing the upload
   * if that goes past the person's limit). Files we can't read keep the reported length.
   */
  private async checkDuration(row: PhotoRow): Promise<number | null> {
    const kind = row.kind as 'video' | 'voice';
    const reported = row.durationMs ?? 0;
    const actual = await mediaDurationMs((start, end) => this.storage.readRange(row.storageKey, start, end), row.byteSize).catch(
      (err: unknown) => {
        this.log.warn(`Couldn't read the length of ${row.id}: ${String(err)}`);
        return null;
      },
    );
    if (actual === null) return reported;
    const delta = actual - reported;
    if (Math.abs(delta) <= DURATION_SLACK_MS) return actual;
    try {
      await this.events.reserveMediaTime(this.db, row.eventId, row.uploaderId, kind, delta);
    } catch (err) {
      // Longer than the time they have: refuse it and give back what was reserved.
      await this.events.reserveMediaTime(this.db, row.eventId, row.uploaderId, kind, -reported);
      await this.setStatus(row.id, 'failed');
      throw err;
    }
    return actual;
  }

  /**
   * Newest first, cursor-paginated. Guests see the shared album once it opens (approved, visible
   * photos) plus their own; the host sees everything, and can list the review queue and hidden ones.
   */
  async list(eventId: string, userId: string, cursor?: string, filter: PhotoListFilter = 'all'): Promise<Page<Photo>> {
    const { event, role } = await this.events.requireMember(eventId, userId);
    if ((filter === 'review' || filter === 'hidden') && role !== 'host') throw new ForbiddenException('Only the host can do that');

    const conditions: SQL[] = [visibleTo(event, role, userId)];
    if (filter === 'photographers') conditions.push(eq(eventMembers.role, 'photographer'));
    if (filter === 'guests') conditions.push(eq(eventMembers.role, 'member'));
    if (filter === 'mine') conditions.push(eq(photos.uploaderId, userId));
    if (filter === 'me') {
      // Photos with a face matching this person's opted-in selfie.
      const ids = await this.faces.matchingPhotoIds(eventId, userId);
      if (ids.length === 0) return { items: [], nextCursor: null };
      conditions.push(inArray(photos.id, ids));
    }
    if (filter === 'review') conditions.push(eq(photos.pendingReview, true));
    if (filter === 'hidden') conditions.push(eq(photos.visibility, 'hidden'));
    if (cursor) {
      const c = decodeCursor(cursor);
      conditions.push(or(lt(photos.createdAt, c.createdAt), and(eq(photos.createdAt, c.createdAt), lt(photos.id, c.id)))!);
    }

    const rows = await this.withExtras(userId)
      .where(and(...conditions))
      .orderBy(desc(photos.createdAt), desc(photos.id))
      .limit(PHOTO_PAGE_SIZE + 1);

    const page = rows.slice(0, PHOTO_PAGE_SIZE);
    const last = page.at(-1);
    return {
      items: await Promise.all(page.map(({ p, ...extras }) => this.toDto(p, extras))),
      nextCursor: rows.length > PHOTO_PAGE_SIZE && last ? encodeCursor(last.p) : null,
    };
  }

  /** Photos with their uploader's name and role, and likes as seen by `viewerId`. */
  private withExtras(viewerId: string) {
    return this.db
      .select({
        p: photos,
        uploaderName: users.name,
        uploaderRole: sql<EventRole>`coalesce(${eventMembers.role}, 'member')`,
        likeCount: sql<number>`(SELECT count(*)::int FROM ${photoLikes} WHERE ${photoLikes.photoId} = ${photos.id})`,
        likedByMe: sql<boolean>`EXISTS (SELECT 1 FROM ${photoLikes} WHERE ${photoLikes.photoId} = ${photos.id} AND ${photoLikes.userId} = ${viewerId})`,
      })
      .from(photos)
      .innerJoin(users, eq(users.id, photos.uploaderId))
      .leftJoin(eventMembers, and(eq(eventMembers.eventId, photos.eventId), eq(eventMembers.userId, photos.uploaderId)));
  }

  private async dtoFor(row: PhotoRow, viewerId: string): Promise<Photo> {
    const [found] = await this.withExtras(viewerId).where(eq(photos.id, row.id)).limit(1);
    if (!found) throw new NotFoundException('Photo not found');
    const { p, ...extras } = found;
    return this.toDto(p, extras);
  }

  /** Uploader can delete their own photo; the host can delete any. Soft delete, purged later. */
  async remove(photoId: string, userId: string) {
    const row = await this.findForUser(photoId, userId);
    const { role } = await this.events.requireMember(row.eventId, userId);
    if (row.uploaderId !== userId && role !== 'host') throw new ForbiddenException('You can only delete your own photos');
    await this.db.update(photos).set({ deletedAt: new Date() }).where(eq(photos.id, row.id));
  }

  /** Host only: hide or unhide a photo, or approve a guest photo waiting for review. */
  async update(photoId: string, userId: string, input: UpdatePhotoInput): Promise<Photo> {
    const row = await this.findForUser(photoId, userId);
    await this.events.requireHost(row.eventId, userId);
    const [updated] = await this.db
      .update(photos)
      .set({
        ...(input.visibility && { visibility: input.visibility }),
        ...(input.approved && { pendingReview: false }),
      })
      .where(eq(photos.id, row.id))
      .returning();
    return this.dtoFor(updated, userId);
  }

  /**
   * Signed link to the untouched original, as a file download. Guests can't save others' photos
   * when the host turned saving off; everyone can always save their own.
   */
  async downloadUrl(photoId: string, userId: string) {
    const row = await this.findForUser(photoId, userId);
    const { event, role } = await this.events.requireMember(row.eventId, userId);
    if (row.status !== 'ready' || !this.canSee(row, event, role, userId)) throw new NotFoundException('Photo not found');
    if (role !== 'host' && row.uploaderId !== userId && !event.allowDownloads) {
      throw forbidden('DOWNLOADS_OFF', 'The hosts turned off saving photos for this event');
    }
    const ext = row.storageKey.split('.').pop();
    return { url: await this.storage.presignDownload(row.storageKey, `eventshare-${row.id}.${ext}`) };
  }

  /** Like or unlike a photo you can see. */
  async setLiked(photoId: string, userId: string, liked: boolean): Promise<PhotoLikes> {
    const row = await this.findForUser(photoId, userId);
    const { event, role } = await this.events.requireMember(row.eventId, userId);
    if (row.status !== 'ready' || !this.canSee(row, event, role, userId)) throw new NotFoundException('Photo not found');
    if (liked) await this.db.insert(photoLikes).values({ photoId: row.id, userId }).onConflictDoNothing();
    else await this.db.delete(photoLikes).where(and(eq(photoLikes.photoId, row.id), eq(photoLikes.userId, userId)));
    const [[n], [mine]] = await Promise.all([
      this.db.select({ n: count() }).from(photoLikes).where(eq(photoLikes.photoId, row.id)),
      this.db.select({ n: count() }).from(photoLikes).where(and(eq(photoLikes.photoId, row.id), eq(photoLikes.userId, userId))),
    ]);
    return { likeCount: n?.n ?? 0, likedByMe: (mine?.n ?? 0) > 0 };
  }

  /** The same rule as visibleTo(), for one photo. */
  private canSee(row: PhotoRow, event: { albumOpensAt: Date | null }, role: EventRole, userId: string) {
    if (role === 'host') return true;
    if (row.visibility !== 'visible') return false;
    return row.uploaderId === userId || (!row.pendingReview && albumOpen(event, role));
  }

  private async findForUser(photoId: string, userId: string) {
    const row = await this.db.query.photos.findFirst({ where: and(eq(photos.id, photoId), isNull(photos.deletedAt)) });
    if (!row) throw new NotFoundException('Photo not found');
    await this.events.requireMember(row.eventId, userId);
    return row;
  }

  private async setStatus(id: string, status: PhotoRow['status']) {
    await this.db.update(photos).set({ status }).where(eq(photos.id, id));
  }

  private async toDto(row: PhotoRow, extras: PhotoExtras): Promise<Photo> {
    const ready = row.status === 'ready';
    const [thumbUrl, url] = ready
      ? await Promise.all([row.thumbKey ? this.storage.presignDownload(row.thumbKey) : null, this.storage.presignDownload(row.storageKey)])
      : [null, null];
    return {
      id: row.id,
      eventId: row.eventId,
      uploader: { id: row.uploaderId, name: extras.uploaderName, role: extras.uploaderRole },
      status: row.status,
      visibility: row.visibility,
      pendingReview: row.pendingReview,
      prompt: row.prompt,
      likeCount: Number(extras.likeCount),
      likedByMe: Boolean(extras.likedByMe),
      width: row.width,
      height: row.height,
      takenAt: row.takenAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      kind: row.kind,
      durationMs: row.durationMs,
      thumbUrl,
      url,
    };
  }
}
