import { PassThrough } from 'node:stream';

import { Inject, Injectable, Logger, NotFoundException, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ARCHIVE_KEEP_DAYS, type ArchiveScope, type ArchiveStatus, type ArchiveSummary } from '@eventshare/shared';
import archiver from 'archiver';
import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';

import { DB, type Db } from '../db/db.module.js';
import { eventArchives, eventMembers, photos, users } from '../db/schema.js';
import { EventsService } from '../events/events.service.js';
import { QueueService } from '../redis/queue.service.js';
import { StorageService } from '../storage/storage.service.js';

type ArchiveRow = typeof eventArchives.$inferSelect;

/** Folder and file names that work on every computer. */
const safe = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').trim().slice(0, 60) || 'Someone';

const ARCHIVE_QUEUE = 'build-archive';
const DAY = 24 * 60 * 60 * 1000;
/** A build that hasn't finished by then died with a restarted server: start over. */
const STALE_BUILD_MS = 30 * 60 * 1000;

/**
 * The host's "Download all": every finished original of the event (or just the photographers'
 * or guests'), untouched, in a ZIP with a folder per person.
 *
 * - The ZIP is streamed from storage straight back into storage: the server only ever holds a
 *   few MB of it, never the whole thing.
 * - It's built in the background; the phone asks again until it's ready, so a slow connection
 *   can't cut the build off.
 * - While the photos are unchanged, the same ZIP is handed out again instead of a new one.
 * - ZIPs are deleted after ARCHIVE_KEEP_DAYS, or as soon as a newer one replaces them.
 */
@Injectable()
export class ArchiveService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ArchiveService.name);
  private sweep?: ReturnType<typeof setInterval>;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly events: EventsService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
  ) {}

  onModuleInit() {
    this.queue.register<{ archiveId: string }>(ARCHIVE_QUEUE, ({ archiveId }) => this.runJob(archiveId), 1);
    this.sweep = setInterval(() => void this.deleteExpired(), 60 * 60 * 1000);
    this.sweep.unref();
  }

  onModuleDestroy() {
    clearInterval(this.sweep);
  }

  private rows(eventId: string, scope: ArchiveScope) {
    const role = sql<string>`coalesce(${eventMembers.role}, 'member')`;
    const conditions = [eq(photos.eventId, eventId), eq(photos.status, 'ready'), isNull(photos.deletedAt)];
    if (scope === 'photographers') conditions.push(sql`${role} = 'photographer'`);
    if (scope === 'guests') conditions.push(sql`${role} <> 'photographer'`);
    return this.db
      .select({
        id: photos.id,
        key: photos.storageKey,
        bytes: photos.byteSize,
        takenAt: photos.takenAt,
        createdAt: photos.createdAt,
        name: users.name,
        uploaderId: photos.uploaderId,
      })
      .from(photos)
      .innerJoin(users, eq(users.id, photos.uploaderId))
      .leftJoin(eventMembers, and(eq(eventMembers.eventId, photos.eventId), eq(eventMembers.userId, photos.uploaderId)))
      .where(and(...conditions))
      .orderBy(photos.createdAt);
  }

  /** How many originals each choice holds, and how big it is. */
  async summary(eventId: string, hostId: string): Promise<ArchiveSummary> {
    await this.events.requireHost(eventId, hostId);
    const [all, ph] = await Promise.all([this.rows(eventId, 'all'), this.rows(eventId, 'photographers')]);
    const total = (list: { bytes: number }[]) => ({ count: list.length, bytes: list.reduce((n, r) => n + r.bytes, 0) });
    const a = total(all);
    const p = total(ph);
    return { all: a, photographers: p, guests: { count: a.count - p.count, bytes: a.bytes - p.bytes } };
  }

  /**
   * Ask for a ZIP: the existing one if its photos haven't changed, else a new one, started in the
   * background. Safe to call again and again while it builds.
   */
  async request(eventId: string, hostId: string, scope: ArchiveScope): Promise<ArchiveStatus> {
    const { event } = await this.events.requireHost(eventId, hostId);
    const list = await this.rows(eventId, scope);
    if (list.length === 0) throw new NotFoundException('No photos to download yet');
    const bytes = list.reduce((n, r) => n + r.bytes, 0);
    // Photos only ever get added or deleted (both change this); hiding one keeps it in the ZIP.
    const newest = list.reduce((t, r) => Math.max(t, r.createdAt.getTime()), 0);
    const fingerprint = `${list.length}:${bytes}:${newest}`;

    const [existing] = await this.db
      .select()
      .from(eventArchives)
      .where(and(eq(eventArchives.eventId, eventId), eq(eventArchives.scope, scope), eq(eventArchives.fingerprint, fingerprint)))
      .orderBy(desc(eventArchives.createdAt))
      .limit(1);
    const fresh = existing && Date.now() - existing.createdAt.getTime() < ARCHIVE_KEEP_DAYS * DAY;
    const stale = existing?.status === 'building' && Date.now() - existing.createdAt.getTime() > STALE_BUILD_MS;
    if (existing && fresh && !stale && existing.status !== 'failed') return this.toStatus(existing, event.name);

    const id = crypto.randomUUID();
    const [row] = await this.db
      .insert(eventArchives)
      .values({ id, eventId, scope, key: `archives/${eventId}/${id}.zip`, fingerprint, photoCount: list.length, byteSize: bytes })
      .returning();
    // On the queue, one at a time: a restart doesn't lose it and big ZIPs can't pile up on the server.
    const queued = await this.queue.add(ARCHIVE_QUEUE, { archiveId: id }, { removeOnFail: true });
    if (!queued) void this.buildAndTidy(row, list);
    return this.toStatus(row, event.name);
  }

  private async toStatus(row: ArchiveRow, eventName: string): Promise<ArchiveStatus> {
    const base = { count: row.photoCount, bytes: row.byteSize };
    if (row.status !== 'ready') return { status: row.status, ...base };
    const filename = `${safe(eventName)} - ${row.scope === 'all' ? 'all photos' : row.scope}.zip`;
    return { status: 'ready', url: await this.storage.presignDownload(row.key, filename), ...base };
  }

  private async runJob(archiveId: string) {
    const row = await this.db.query.eventArchives.findFirst({ where: eq(eventArchives.id, archiveId) });
    if (row?.status !== 'building') return;
    await this.buildAndTidy(row, await this.rows(row.eventId, row.scope));
  }

  private async buildAndTidy(row: ArchiveRow, list: Awaited<ReturnType<ArchiveService['rows']>>) {
    await this.build(row, list);
    await this.deleteReplaced(row);
  }

  private async build(row: ArchiveRow, list: Awaited<ReturnType<ArchiveService['rows']>>) {
    try {
      const zip = archiver('zip', { store: true }); // photos are already compressed
      const out = new PassThrough();
      zip.pipe(out);
      const upload = this.storage.uploadStream(row.key, out, 'application/zip');

      // One person's photos are numbered in the order they were taken.
      const seen = new Map<string, number>();
      const names = new Map<string, string>();
      let next = 0;
      const appendNext = async () => {
        const photo = list[next++];
        if (!photo) return void zip.finalize();
        const n = (seen.get(photo.uploaderId) ?? 0) + 1;
        seen.set(photo.uploaderId, n);
        // Two people with the same name still get their own folders.
        if (!names.has(photo.uploaderId)) {
          const base = safe(photo.name);
          const taken = [...names.values()].filter((v) => v === base || v.startsWith(`${base} (`)).length;
          names.set(photo.uploaderId, taken ? `${base} (${taken + 1})` : base);
        }
        const ext = photo.key.split('.').pop() ?? 'jpg';
        const date = (photo.takenAt ?? photo.createdAt).toISOString().slice(0, 10);
        zip.append(await this.storage.stream(photo.key), {
          name: `${names.get(photo.uploaderId)}/${String(n).padStart(3, '0')} ${date}.${ext}`,
          date: photo.takenAt ?? photo.createdAt,
        });
      };
      const fail = (err: unknown) => out.destroy(err instanceof Error ? err : new Error(String(err))); // ends the upload with the error
      // Add the next file only once the last one is in, so only one download is open at a time.
      zip.on('entry', () => void appendNext().catch(fail));
      zip.on('error', fail);
      await appendNext();
      await upload;
      await this.db.update(eventArchives).set({ status: 'ready' }).where(eq(eventArchives.id, row.id));
    } catch (err) {
      this.log.error(`Archive ${row.key} failed: ${String(err)}`);
      await this.db.update(eventArchives).set({ status: 'failed' }).where(eq(eventArchives.id, row.id));
      await this.storage.delete(row.key).catch(() => undefined);
    }
  }

  /** A newer ZIP of the same choice is ready: the older ones can go now. */
  private async deleteReplaced(row: ArchiveRow) {
    const older = await this.db
      .select()
      .from(eventArchives)
      .where(and(eq(eventArchives.eventId, row.eventId), eq(eventArchives.scope, row.scope), lt(eventArchives.createdAt, row.createdAt)));
    await this.remove(older);
  }

  /** ZIPs past their keep time, and failed builds. Runs hourly. */
  async deleteExpired() {
    try {
      const cutoff = new Date(Date.now() - ARCHIVE_KEEP_DAYS * DAY);
      const old = await this.db
        .select()
        .from(eventArchives)
        .where(or(lt(eventArchives.createdAt, cutoff), eq(eventArchives.status, 'failed')));
      await this.remove(old);
    } catch (err) {
      this.log.warn(`Archive cleanup skipped: ${String(err)}`);
    }
  }

  private async remove(rows: ArchiveRow[]) {
    for (const r of rows) {
      // Never pull a ZIP out from under a build that's still running.
      if (r.status === 'building' && Date.now() - r.createdAt.getTime() < STALE_BUILD_MS) continue;
      await this.storage.delete(r.key).catch((err: unknown) => this.log.warn(`Couldn't delete ${r.key}: ${String(err)}`));
      await this.db.delete(eventArchives).where(eq(eventArchives.id, r.id));
    }
  }
}

