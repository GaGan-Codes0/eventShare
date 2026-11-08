import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  FACE_MATCH_THRESHOLD,
  type FaceProfileInput,
  type PendingFaceScan,
  type SaveFacesInput,
} from '@eventshare/shared';
import { and, cosineDistance, eq, isNull, lte, sql } from 'drizzle-orm';

import { DB, type Db } from '../db/db.module.js';
import { faceProfiles, photoFaces, photos } from '../db/schema.js';
import { EventsService } from '../events/events.service.js';
import { RedisService } from '../redis/redis.service.js';
import { StorageService } from '../storage/storage.service.js';

/** How many older photos the host's phone is handed at a time to look for faces in. */
const PENDING_BATCH = 20;

/** A guest's matches are reused this long: "Me" reloads often, and matching is the costly part. */
const MATCH_CACHE_SECONDS = 20;

/**
 * "Find my photos", the hybrid way: phones make the faceprints (no face model runs here),
 * the server only stores them and compares numbers. Nothing here sees a face picture.
 */
@Injectable()
export class FacesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly events: EventsService,
    private readonly storage: StorageService,
    private readonly redis: RedisService,
  ) {}

  /**
   * The faces found in a photo, sent by the phone that uploaded it (or the host's phone, for
   * older photos). Replaces any earlier result for the photo; an empty list means "no faces".
   */
  async saveFaces(photoId: string, userId: string, input: SaveFacesInput) {
    const photo = await this.db.query.photos.findFirst({ where: and(eq(photos.id, photoId), isNull(photos.deletedAt)) });
    if (!photo) throw new NotFoundException('Photo not found');
    const { role } = await this.events.requireMember(photo.eventId, userId);
    if (photo.uploaderId !== userId && role !== 'host') throw new ForbiddenException('Only the uploader or the host can do that');

    await this.db.transaction(async (tx) => {
      await tx.delete(photoFaces).where(and(eq(photoFaces.photoId, photoId), eq(photoFaces.model, input.model)));
      if (input.faces.length) {
        await tx.insert(photoFaces).values(
          input.faces.map((f) => ({ photoId, eventId: photo.eventId, model: input.model, embedding: f.embedding, box: f.box })),
        );
      }
      await tx.update(photos).set({ facesScannedAt: new Date() }).where(eq(photos.id, photoId));
    });
    return { faces: input.faces.length };
  }

  /** Host: photos nobody has looked for faces in yet (uploaded before this existed), oldest first. */
  async pending(eventId: string, hostId: string): Promise<PendingFaceScan[]> {
    const { event } = await this.events.requireHost(eventId, hostId);
    if (!event.findMyPhotos) return [];
    const rows = await this.db
      .select({ id: photos.id, key: photos.storageKey })
      .from(photos)
      .where(
        and(
          eq(photos.eventId, eventId),
          eq(photos.kind, 'photo'),
          eq(photos.status, 'ready'),
          isNull(photos.deletedAt),
          isNull(photos.facesScannedAt),
        ),
      )
      .orderBy(photos.createdAt)
      .limit(PENDING_BATCH);
    return Promise.all(rows.map(async (r) => ({ id: r.id, url: await this.storage.presignDownload(r.key) })));
  }

  /** A guest opts in with their selfie's faceprint. Only while the host has Find my photos on. */
  async setProfile(eventId: string, userId: string, input: FaceProfileInput) {
    const { event } = await this.events.requireMember(eventId, userId);
    if (!event.findMyPhotos) throw new ForbiddenException('The hosts haven’t turned on Find my photos');
    await this.db
      .insert(faceProfiles)
      .values({ eventId, userId, model: input.model, embedding: input.embedding })
      .onConflictDoUpdate({
        target: [faceProfiles.eventId, faceProfiles.userId],
        set: { model: input.model, embedding: input.embedding, consentedAt: new Date() },
      });
  }

  /** Opt out: the faceprint is deleted for good. */
  async deleteProfile(eventId: string, userId: string) {
    await this.events.requireMember(eventId, userId);
    await this.db.delete(faceProfiles).where(and(eq(faceProfiles.eventId, eventId), eq(faceProfiles.userId, userId)));
  }

  async hasProfile(eventId: string, userId: string) {
    const [row] = await this.db
      .select({ n: sql<number>`1` })
      .from(faceProfiles)
      .where(and(eq(faceProfiles.eventId, eventId), eq(faceProfiles.userId, userId)))
      .limit(1);
    return Boolean(row);
  }

  /**
   * The photos in this event with a face that matches this person's selfie. Visibility (review,
   * hidden, the album not open yet) is applied by the photo list itself, on top of this.
   */
  async matchingPhotoIds(eventId: string, userId: string): Promise<string[]> {
    const profile = await this.db.query.faceProfiles.findFirst({
      where: and(eq(faceProfiles.eventId, eventId), eq(faceProfiles.userId, userId)),
    });
    if (!profile) return [];
    // A new selfie changes the key, so it never gets the old selfie's matches.
    const cacheKey = `faces:${eventId}:${userId}:${profile.consentedAt.getTime()}`;
    const cached = await this.redis.getJson<string[]>(cacheKey);
    if (cached) return cached;

    // Compared inside Postgres (pgvector), so faceprints never have to be loaded into the API.
    const rows = await this.db
      .selectDistinct({ photoId: photoFaces.photoId })
      .from(photoFaces)
      .where(
        and(
          eq(photoFaces.eventId, eventId),
          eq(photoFaces.model, profile.model),
          lte(cosineDistance(photoFaces.embedding, profile.embedding), 1 - FACE_MATCH_THRESHOLD),
        ),
      );
    const ids = rows.map((r) => r.photoId);
    await this.redis.setJson(cacheKey, ids, MATCH_CACHE_SECONDS);
    return ids;
  }

  /** The host turned Find my photos off: every guest's faceprint for the event goes. */
  async forgetEvent(eventId: string) {
    await this.db.delete(faceProfiles).where(eq(faceProfiles.eventId, eventId));
  }
}
