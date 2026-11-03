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
  type CreateUploadInput,
  type Page,
  type Photo,
  type PhotoVisibility,
  type UploadTicket,
} from '@eventshare/shared';
import { and, desc, eq, isNull, lt, or, type SQL } from 'drizzle-orm';
import sharp from 'sharp';

import { DB, type Db } from '../db/db.module.js';
import { photos, users } from '../db/schema.js';
import { EventsService } from '../events/events.service.js';
import { StorageService } from '../storage/storage.service.js';

type PhotoRow = typeof photos.$inferSelect;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/png': 'png',
  'image/webp': 'webp',
};

function encodeCursor(row: { createdAt: Date; id: string }) {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`).toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  const [iso, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const createdAt = new Date(iso ?? '');
  if (!id || Number.isNaN(createdAt.getTime())) throw new BadRequestException('Bad cursor');
  return { createdAt, id };
}

@Injectable()
export class PhotosService {
  private readonly log = new Logger(PhotosService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly events: EventsService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Step 1 of an upload. Idempotent per (uploader, clientUploadId): a retry gets the same
   * photo back, and once it's complete there is nothing left to upload.
   */
  async createUpload(eventId: string, userId: string, input: CreateUploadInput): Promise<UploadTicket> {
    await this.events.requireMember(eventId, userId);

    let row = await this.db.query.photos.findFirst({
      where: and(eq(photos.uploaderId, userId), eq(photos.clientUploadId, input.clientUploadId)),
    });
    if (row && row.eventId !== eventId) throw new ConflictException('Upload id already used for another event');

    if (!row) {
      const id = crypto.randomUUID();
      const base = `events/${eventId}/photos/${id}`;
      [row] = await this.db
        .insert(photos)
        .values({
          id,
          eventId,
          uploaderId: userId,
          clientUploadId: input.clientUploadId,
          storageKey: `${base}/original.${EXTENSIONS[input.contentType]}`,
          thumbKey: `${base}/thumb.jpg`,
          contentType: input.contentType,
          byteSize: input.byteSize,
          width: input.width,
          height: input.height,
          takenAt: input.takenAt ? new Date(input.takenAt) : null,
        })
        .onConflictDoNothing()
        .returning();
      // Lost a race with a concurrent retry: use the row it created.
      row ??= await this.db.query.photos.findFirst({
        where: and(eq(photos.uploaderId, userId), eq(photos.clientUploadId, input.clientUploadId)),
      });
      if (!row) throw new ConflictException('Please retry');
    }

    if (row.status === 'ready') return { photoId: row.id, status: row.status, original: null, thumb: null };

    const [originalUrl, thumbUrl] = await Promise.all([
      this.storage.presignUpload(row.storageKey, row.contentType, row.byteSize),
      this.storage.presignUpload(row.thumbKey, 'image/jpeg', input.thumbByteSize),
    ]);
    return {
      photoId: row.id,
      status: row.status,
      original: { url: originalUrl, headers: { 'Content-Type': row.contentType } },
      thumb: { url: thumbUrl, headers: { 'Content-Type': 'image/jpeg' } },
    };
  }

  /** Step 2: the phone says both files are uploaded. We verify before showing it to anyone. */
  async complete(photoId: string, userId: string): Promise<Photo> {
    const row = await this.db.query.photos.findFirst({ where: and(eq(photos.id, photoId), isNull(photos.deletedAt)) });
    if (!row || row.uploaderId !== userId) throw new NotFoundException('Photo not found');
    await this.events.requireMember(row.eventId, userId);
    if (row.status === 'ready') return this.toDto(row, await this.uploaderName(row.uploaderId));

    const [original, thumb] = await Promise.all([this.storage.head(row.storageKey), this.storage.head(row.thumbKey)]);
    if (!original || !thumb) throw new BadRequestException('Upload not finished');
    if (original.size !== row.byteSize) {
      await this.setStatus(row.id, 'failed');
      throw new BadRequestException('Uploaded file size does not match');
    }

    // The thumbnail is small: decode it to make sure it really is an image.
    try {
      const meta = await sharp(await this.storage.read(row.thumbKey)).metadata();
      if (!meta.width || !meta.height) throw new Error('no dimensions');
    } catch (err) {
      this.log.warn(`Invalid thumbnail for photo ${row.id}: ${String(err)}`);
      await this.setStatus(row.id, 'failed');
      throw new BadRequestException('Preview image is invalid');
    }

    const [ready] = await this.db.update(photos).set({ status: 'ready' }).where(eq(photos.id, row.id)).returning();
    return this.toDto(ready, await this.uploaderName(ready.uploaderId));
  }

  /** Newest first, cursor-paginated. Hidden photos are only listed for the host. */
  async list(eventId: string, userId: string, cursor?: string): Promise<Page<Photo>> {
    const { role } = await this.events.requireMember(eventId, userId);

    const conditions: SQL[] = [eq(photos.eventId, eventId), eq(photos.status, 'ready'), isNull(photos.deletedAt)];
    if (role !== 'host') conditions.push(eq(photos.visibility, 'visible'));
    if (cursor) {
      const c = decodeCursor(cursor);
      conditions.push(or(lt(photos.createdAt, c.createdAt), and(eq(photos.createdAt, c.createdAt), lt(photos.id, c.id)))!);
    }

    const rows = await this.db
      .select({ p: photos, uploaderName: users.name })
      .from(photos)
      .innerJoin(users, eq(users.id, photos.uploaderId))
      .where(and(...conditions))
      .orderBy(desc(photos.createdAt), desc(photos.id))
      .limit(PHOTO_PAGE_SIZE + 1);

    const page = rows.slice(0, PHOTO_PAGE_SIZE);
    const last = page.at(-1);
    return {
      items: await Promise.all(page.map((r) => this.toDto(r.p, r.uploaderName))),
      nextCursor: rows.length > PHOTO_PAGE_SIZE && last ? encodeCursor(last.p) : null,
    };
  }

  /** Uploader can delete their own photo; the host can delete any. Soft delete, purged later. */
  async remove(photoId: string, userId: string) {
    const row = await this.findForUser(photoId, userId);
    const { role } = await this.events.requireMember(row.eventId, userId);
    if (row.uploaderId !== userId && role !== 'host') throw new ForbiddenException('You can only delete your own photos');
    await this.db.update(photos).set({ deletedAt: new Date() }).where(eq(photos.id, row.id));
  }

  /** Host only: hide a photo from guests without deleting it. */
  async setVisibility(photoId: string, userId: string, visibility: PhotoVisibility): Promise<Photo> {
    const row = await this.findForUser(photoId, userId);
    await this.events.requireHost(row.eventId, userId);
    const [updated] = await this.db.update(photos).set({ visibility }).where(eq(photos.id, row.id)).returning();
    return this.toDto(updated, await this.uploaderName(updated.uploaderId));
  }

  /** Signed link to the untouched original, as a file download. */
  async downloadUrl(photoId: string, userId: string) {
    const row = await this.findForUser(photoId, userId);
    const { role } = await this.events.requireMember(row.eventId, userId);
    if (row.status !== 'ready' || (row.visibility === 'hidden' && role !== 'host')) throw new NotFoundException('Photo not found');
    const ext = row.storageKey.split('.').pop();
    return { url: await this.storage.presignDownload(row.storageKey, `eventshare-${row.id}.${ext}`) };
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

  private async uploaderName(id: string) {
    const u = await this.db.query.users.findFirst({ where: eq(users.id, id), columns: { name: true } });
    return u?.name ?? 'Someone';
  }

  private async toDto(row: PhotoRow, uploaderName: string): Promise<Photo> {
    const ready = row.status === 'ready';
    const [thumbUrl, url] = ready
      ? await Promise.all([this.storage.presignDownload(row.thumbKey), this.storage.presignDownload(row.storageKey)])
      : [null, null];
    return {
      id: row.id,
      eventId: row.eventId,
      uploader: { id: row.uploaderId, name: uploaderName },
      status: row.status,
      visibility: row.visibility,
      width: row.width,
      height: row.height,
      takenAt: row.takenAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      thumbUrl,
      url,
    };
  }
}
