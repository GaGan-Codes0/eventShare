import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';

import { DB, type Db } from '../db/db.module.js';
import { eventArchives, eventMembers, events, faceProfiles, photoFaces, photoLikes, photos, users } from '../db/schema.js';
import { StorageService } from '../storage/storage.service.js';

/** How many files are removed from storage at once. */
const DELETE_CONCURRENCY = 8;

/**
 * Deleting an account (App Store rule 5.1.1(v)): the person, everything they added, and the events
 * they host (with everyone's photos in them). Rows are emptied or marked deleted in one
 * transaction; the files are then removed from storage. Copies people already saved to their
 * phones are out of our reach.
 */
@Injectable()
export class AccountService {
  private readonly log = new Logger(AccountService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly storage: StorageService,
  ) {}

  async delete(userId: string) {
    const now = new Date();
    const keys = await this.db.transaction(async (tx) => {
      const hosted = await tx
        .select({ id: events.id, logoKey: events.logoKey, posterKey: events.posterKey, frameKey: events.frameKey })
        .from(events)
        .where(and(eq(events.ownerId, userId), isNull(events.deletedAt)));
      const hostedIds = hosted.map((e) => e.id);

      // Their own photos anywhere, plus every photo in the events they host.
      const gone = await tx
        .select({ id: photos.id, storageKey: photos.storageKey, thumbKey: photos.thumbKey, previewKey: photos.previewKey })
        .from(photos)
        .where(and(isNull(photos.deletedAt), hostedIds.length ? or(eq(photos.uploaderId, userId), inArray(photos.eventId, hostedIds)) : eq(photos.uploaderId, userId)));
      const photoIds = gone.map((p) => p.id);

      if (photoIds.length) {
        await tx.update(photos).set({ deletedAt: now }).where(inArray(photos.id, photoIds));
        await tx.delete(photoFaces).where(inArray(photoFaces.photoId, photoIds));
        await tx.delete(photoLikes).where(inArray(photoLikes.photoId, photoIds));
      }
      await tx.delete(photoLikes).where(eq(photoLikes.userId, userId));
      await tx.delete(faceProfiles).where(eq(faceProfiles.userId, userId));

      let archiveKeys: string[] = [];
      if (hostedIds.length) {
        await tx.update(events).set({ deletedAt: now }).where(inArray(events.id, hostedIds));
        await tx.delete(faceProfiles).where(inArray(faceProfiles.eventId, hostedIds));
        archiveKeys = (await tx.delete(eventArchives).where(inArray(eventArchives.eventId, hostedIds)).returning({ key: eventArchives.key })).map(
          (a) => a.key,
        );
      }
      await tx
        .update(eventMembers)
        .set({ status: 'removed', removedAt: now })
        .where(and(eq(eventMembers.userId, userId), eq(eventMembers.status, 'active')));

      // Nothing personal stays; the row remains only so old references still point somewhere.
      await tx
        .update(users)
        .set({ authId: `deleted_${userId}`, name: 'Deleted user', email: null, passwordHash: null, avatarUrl: null, deletedAt: now })
        .where(eq(users.id, userId));

      return [
        ...gone.flatMap((p) => [p.storageKey, p.thumbKey, p.previewKey]),
        ...hosted.flatMap((e) => [e.logoKey, e.posterKey, e.frameKey]),
        ...archiveKeys,
      ].filter((k): k is string => !!k);
    });

    // Files go after the rows, so a storage hiccup never leaves a half-deleted account.
    void this.removeFiles(keys);
  }

  private async removeFiles(keys: string[]) {
    let failed = 0;
    for (let i = 0; i < keys.length; i += DELETE_CONCURRENCY) {
      const results = await Promise.allSettled(keys.slice(i, i + DELETE_CONCURRENCY).map((k) => this.storage.delete(k)));
      failed += results.filter((r) => r.status === 'rejected').length;
    }
    if (failed) this.log.warn(`Account deletion: ${failed} of ${keys.length} files could not be removed`);
  }
}
