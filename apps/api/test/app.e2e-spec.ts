/**
 * Core flow, end to end, against the local stack (`docker compose up -d` + apps/api/.env with
 * AUTH_DEV_BYPASS=true): create → join → upload → gallery → permissions.
 */
import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { AppModule } from './../src/app.module.js';
import { StorageService } from './../src/storage/storage.service.js';

describe('core flow (e2e)', () => {
  let app: INestApplication<App>;
  const run = randomUUID().slice(0, 8);
  const host = `host${run}`;
  const guest = `guest${run}`;
  const outsider = `out${run}`;
  const as = (user: string) => ({ 'x-dev-user': user });

  let original: Buffer;
  let thumb: Buffer;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    original = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: '#385447' } })
      .jpeg({ quality: 95 })
      .toBuffer();
    thumb = await sharp(original).resize(720).jpeg({ quality: 80 }).toBuffer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('shares photos between members, untouched, and enforces permissions', async () => {
    const http = () => request(app.getHttpServer());

    const created = await http().post('/events').set(as(host)).send({ name: 'Riya & Arjun', location: 'Jaipur' }).expect(201);
    const { id: eventId, joinCode } = created.body as { id: string; joinCode: string };
    expect(created.body.role).toBe('host');

    // Not a member yet: the event is invisible.
    await http().get(`/events/${eventId}`).set(as(guest)).expect(404);

    const preview = await http().get(`/join/${joinCode}`).set(as(guest)).expect(200);
    expect(preview.body).toMatchObject({ name: 'Riya & Arjun', memberCount: 1 });

    // Codes are case- and dash-insensitive.
    const loose = `${joinCode.slice(0, 4)}-${joinCode.slice(4)}`.toLowerCase();
    const joined = await http().post('/join').set(as(guest)).send({ code: loose }).expect(201);
    expect(joined.body).toMatchObject({ role: 'member', memberCount: 2 });

    // Upload: ticket → PUT both files straight to storage → complete.
    const clientUploadId = randomUUID();
    const body = { clientUploadId, contentType: 'image/jpeg', byteSize: original.length, thumbByteSize: thumb.length };
    const ticket = await http().post(`/events/${eventId}/photos/uploads`).set(as(guest)).send(body).expect(201);
    const { photoId } = ticket.body as { photoId: string };

    await http().post(`/photos/${photoId}/complete`).set(as(guest)).expect(400); // nothing uploaded yet
    for (const [target, bytes] of [
      [ticket.body.original, original],
      [ticket.body.thumb, thumb],
    ] as const) {
      const res = await fetch(target.url, { method: 'PUT', headers: target.headers, body: new Uint8Array(bytes) });
      expect(res.status).toBe(200);
    }
    const done = await http().post(`/photos/${photoId}/complete`).set(as(guest)).expect(201);
    expect(done.body.status).toBe('ready');

    // Retrying the same upload is a no-op.
    const retry = await http().post(`/events/${eventId}/photos/uploads`).set(as(guest)).send(body).expect(201);
    expect(retry.body).toMatchObject({ photoId, original: null, thumb: null });

    // The host sees it, and the original comes back byte-for-byte.
    const gallery = await http().get(`/events/${eventId}/photos`).set(as(host)).expect(200);
    expect(gallery.body.items).toHaveLength(1);
    const downloaded = Buffer.from(await (await fetch(gallery.body.items[0].url)).arrayBuffer());
    expect(downloaded.equals(original)).toBe(true);

    // The newest photo is the event's cover in everyone's events list.
    const listed = (await http().get('/events').set(as(guest))).body.find((e: { id: string }) => e.id === eventId);
    const cover = Buffer.from(await (await fetch(listed.coverUrl)).arrayBuffer());
    expect(cover.equals(thumb)).toBe(true);

    // Outsiders and guests are kept in their lane.
    await http().get(`/events/${eventId}/photos`).set(as(outsider)).expect(404);
    await http().patch(`/photos/${photoId}`).set(as(guest)).send({ visibility: 'hidden' }).expect(403);

    // Host hides it: guests stop seeing it, the host still does.
    await http().patch(`/photos/${photoId}`).set(as(host)).send({ visibility: 'hidden' }).expect(200);
    expect((await http().get(`/events/${eventId}/photos`).set(as(guest))).body.items).toHaveLength(0);
    expect((await http().get(`/events/${eventId}/photos`).set(as(host))).body.items).toHaveLength(1);
    // A hidden photo never becomes the event's cover.
    const hiddenCover = (await http().get('/events').set(as(host))).body.find((e: { id: string }) => e.id === eventId);
    expect(hiddenCover.coverUrl).toBeNull();

    // Host removes the guest: access gone, and the code no longer lets them back in.
    const guestId = (await http().get('/me').set(as(guest))).body.id as string;
    await http().delete(`/events/${eventId}/members/${guestId}`).set(as(host)).expect(204);
    await http().get(`/events/${eventId}/photos`).set(as(guest)).expect(404);
    await http().post('/join').set(as(guest)).send({ code: joinCode }).expect(403);
  });

  it('caps photos per role and lets the host make a guest the photographer', async () => {
    const http = () => request(app.getHttpServer());
    const host2 = `host2${run}`;
    const shooter = `shoot${run}`;
    let eventId = '';
    const startUpload = (user: string, clientUploadId = randomUUID()) =>
      http()
        .post(`/events/${eventId}/photos/uploads`)
        .set(as(user))
        .send({ clientUploadId, contentType: 'image/jpeg', byteSize: original.length, thumbByteSize: thumb.length });

    await http().post('/events').set(as(host2)).send({ name: 'Sangeet', guestPhotoLimit: 30 }).expect(400);
    const created = await http().post('/events').set(as(host2)).send({ name: 'Sangeet', guestPhotoLimit: 24 }).expect(201);
    eventId = created.body.id;
    expect(created.body).toMatchObject({ guestPhotoLimit: 24, photoLimit: 500, photosUsed: 0 });

    // Only the host changes the guest allowance, and only to 10, 24, 36, 50 or no limit.
    const joined = await http().post('/join').set(as(shooter)).send({ code: created.body.joinCode }).expect(201);
    expect(joined.body).toMatchObject({ role: 'member', photoLimit: 24 });
    await http().patch(`/events/${eventId}`).set(as(shooter)).send({ guestPhotoLimit: 36 }).expect(403);
    await http().patch(`/events/${eventId}`).set(as(host2)).send({ guestPhotoLimit: 40 }).expect(400);
    await http().patch(`/events/${eventId}`).set(as(host2)).send({ guestPhotoLimit: 10 }).expect(200);

    // 8 photos, then 5 at once with 2 slots left: exactly 2 get through.
    for (let i = 0; i < 8; i++) await startUpload(shooter).expect(201);
    const burst = await Promise.all(Array.from({ length: 5 }, () => startUpload(shooter)));
    expect(burst.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 201, 403, 403, 403]);
    expect(burst.find((r) => r.status === 403)!.body).toMatchObject({
      code: 'PHOTO_LIMIT_REACHED',
      message: "You've used all 10 of your photos for this event",
    });

    // A photo that already has its slot can still be retried at the limit; a new one can't.
    const kept = randomUUID();
    await http().patch(`/events/${eventId}`).set(as(host2)).send({ guestPhotoLimit: 24 }).expect(200);
    await startUpload(shooter, kept).expect(201);
    await http().patch(`/events/${eventId}`).set(as(host2)).send({ guestPhotoLimit: 10 }).expect(200);
    await startUpload(shooter, kept).expect(201);
    await startUpload(shooter).expect(403);

    // Promoted to photographer: 1,000 photos, listed right after the host.
    const shooterId = (await http().get('/me').set(as(shooter))).body.id as string;
    const hostId = (await http().get('/me').set(as(host2))).body.id as string;
    await http().patch(`/events/${eventId}/members/${shooterId}`).set(as(shooter)).send({ role: 'photographer' }).expect(403);
    await http().patch(`/events/${eventId}/members/${hostId}`).set(as(host2)).send({ role: 'member' }).expect(404);
    await http().patch(`/events/${eventId}/members/${shooterId}`).set(as(host2)).send({ role: 'host' }).expect(400);
    const promoted = await http()
      .patch(`/events/${eventId}/members/${shooterId}`)
      .set(as(host2))
      .send({ role: 'photographer' })
      .expect(200);
    expect(promoted.body).toMatchObject({ role: 'photographer', photosUsed: 11 });
    await startUpload(shooter).expect(201);
    const asShooter = await http().get(`/events/${eventId}`).set(as(shooter)).expect(200);
    expect(asShooter.body).toMatchObject({ role: 'photographer', photoLimit: 1000, photosUsed: 12 });
    const members = await http().get(`/events/${eventId}/members`).set(as(host2)).expect(200);
    expect(members.body.map((m: { role: string }) => m.role)).toEqual(['host', 'photographer']);

    // Photographers still can't moderate other people's photos.
    const hostPhoto = await startUpload(host2).expect(201);
    await http().patch(`/photos/${hostPhoto.body.photoId}`).set(as(shooter)).send({ visibility: 'hidden' }).expect(403);
    await http().delete(`/photos/${hostPhoto.body.photoId}`).set(as(shooter)).expect(403);

    // Back to guest: already over the guest allowance, so no more photos.
    await http().patch(`/events/${eventId}/members/${shooterId}`).set(as(host2)).send({ role: 'member' }).expect(200);
    await startUpload(shooter).expect(403);

    // The host's theme reaches guests and the join preview; guests can't change it.
    expect(created.body.theme).toBeNull();
    const theme = { preset: 'blush', accent: '#a2475e', fonts: 'romantic', frame: 'polaroid' };
    await http().patch(`/events/${eventId}`).set(as(shooter)).send({ theme }).expect(403);
    await http().patch(`/events/${eventId}`).set(as(host2)).send({ theme: { ...theme, accent: 'pink' } }).expect(400);
    await http().patch(`/events/${eventId}`).set(as(host2)).send({ theme: { ...theme, frame: 'neon' } }).expect(400);
    const themed = await http().patch(`/events/${eventId}`).set(as(host2)).send({ theme }).expect(200);
    expect(themed.body.theme).toEqual({ ...theme, accent: '#A2475E' });
    expect((await http().get(`/events/${eventId}`).set(as(shooter))).body.theme).toEqual(themed.body.theme);
    expect((await http().get(`/join/${created.body.joinCode}`).set(as(`late${run}`))).body.theme).toEqual(themed.body.theme);
    const reset = await http().patch(`/events/${eventId}`).set(as(host2)).send({ theme: null }).expect(200);
    expect(reset.body.theme).toBeNull();

    // The host's poster replaces the newest photo as the cover; only real, uploaded images of this event count.
    const png = await sharp({ create: { width: 400, height: 400, channels: 4, background: '#A2475E' } }).png().toBuffer();
    const image = { kind: 'poster', contentType: 'image/png', byteSize: png.length };
    await http().post(`/events/${eventId}/images`).set(as(shooter)).send(image).expect(403);
    await http().post(`/events/${eventId}/images`).set(as(host2)).send({ ...image, byteSize: 16 * 1024 * 1024 }).expect(400);
    const poster = await http().post(`/events/${eventId}/images`).set(as(host2)).send(image).expect(201);
    expect(poster.body.key).toMatch(new RegExp(`^events/${eventId}/poster/.+\\.png$`));
    await http().patch(`/events/${eventId}`).set(as(host2)).send({ posterKey: poster.body.key }).expect(400); // not uploaded yet
    const put = await fetch(poster.body.upload.url, { method: 'PUT', headers: poster.body.upload.headers, body: new Uint8Array(png) });
    expect(put.status).toBe(200);
    await http().patch(`/events/${eventId}`).set(as(host2)).send({ logoKey: poster.body.key }).expect(400); // a poster isn't a logo
    await http().patch(`/events/${eventId}`).set(as(host2)).send({ posterKey: `events/${randomUUID()}/poster/x.png` }).expect(400);
    const withPoster = await http().patch(`/events/${eventId}`).set(as(host2)).send({ posterKey: poster.body.key }).expect(200);
    // Replacing the poster deletes the old picture from storage (in the background).
    const second = await http().post(`/events/${eventId}/images`).set(as(host2)).send(image).expect(201);
    await fetch(second.body.upload.url, { method: 'PUT', headers: second.body.upload.headers, body: new Uint8Array(png) });
    await http().patch(`/events/${eventId}`).set(as(host2)).send({ posterKey: second.body.key }).expect(200);
    const storage = app.get(StorageService);
    for (let i = 0; i < 20 && (await storage.head(poster.body.key)); i++) await new Promise((done) => setTimeout(done, 100));
    expect(await storage.head(poster.body.key)).toBeNull();
    expect(await storage.head(second.body.key)).not.toBeNull();
    expect(withPoster.body.posterUrl).toContain('/poster/');
    expect(withPoster.body.coverUrl).toContain('/poster/');
    expect((await http().get(`/join/${created.body.joinCode}`).set(as(`late${run}`))).body.posterUrl).toContain('/poster/');
    const fake = await http().post(`/events/${eventId}/images`).set(as(host2)).send({ ...image, kind: 'logo', byteSize: 5 }).expect(201);
    await fetch(fake.body.upload.url, { method: 'PUT', headers: fake.body.upload.headers, body: new TextEncoder().encode('hello') });
    await http().patch(`/events/${eventId}`).set(as(host2)).send({ logoKey: fake.body.key }).expect(400); // not an image
    const cleared = await http().patch(`/events/${eventId}`).set(as(host2)).send({ posterKey: null }).expect(200);
    expect(cleared.body).toMatchObject({ posterUrl: null, logoUrl: null });
    expect(cleared.body.coverUrl).toBeNull(); // no finished photos in this event to fall back on
  });

  it('applies the host rules: names, review, reveal, camera roll, saving, likes, photographer slots', async () => {
    const http = () => request(app.getHttpServer());
    const h = `wedhost${run}`;
    const g1 = `wedg1${run}`;
    const g2 = `wedg2${run}`;
    let eventId = '';
    /** Ticket → PUT both files → complete. Returns the photo id. */
    const upload = async (user: string, extra: Record<string, unknown> = {}) => {
      const ticket = await http()
        .post(`/events/${eventId}/photos/uploads`)
        .set(as(user))
        .send({ clientUploadId: randomUUID(), contentType: 'image/jpeg', byteSize: original.length, thumbByteSize: thumb.length, ...extra })
        .expect(201);
      for (const [target, bytes] of [
        [ticket.body.original, original],
        [ticket.body.thumb, thumb],
      ] as const) {
        await fetch(target.url, { method: 'PUT', headers: target.headers, body: new Uint8Array(bytes) });
      }
      await http().post(`/photos/${ticket.body.photoId}/complete`).set(as(user)).expect(201);
      return ticket.body.photoId as string;
    };
    const album = async (user: string, filter = 'all') =>
      ((await http().get(`/events/${eventId}/photos?filter=${filter}`).set(as(user)).expect(200)).body.items as { id: string }[]).map((p) => p.id);

    // A wedding is named after the couple; without both names it's refused.
    await http().post('/events').set(as(h)).send({ type: 'wedding', partner1: 'Tanya' }).expect(400);
    const created = await http()
      .post('/events')
      .set(as(h))
      .send({ type: 'wedding', partner1: 'Tanya', partner2: 'Paul', tagline: 'Shoot everything.', prompts: ['The first look'] })
      .expect(201);
    eventId = created.body.id;
    expect(created.body).toMatchObject({
      name: 'Tanya & Paul',
      type: 'wedding',
      joiner: '&',
      guestPhotoLimit: 36,
      revealMode: 'live',
      albumOpen: true,
      requireReview: false,
      allowDownloads: true,
      allowLibraryUploads: true,
      dateStamp: true,
      filter: 'natural',
      prompts: ['The first look'],
    });
    const renamed = await http().patch(`/events/${eventId}`).set(as(h)).send({ joiner: 'and', filter: 'golden' }).expect(200);
    expect(renamed.body).toMatchObject({ name: 'Tanya and Paul', filter: 'golden' });
    await http().post('/join').set(as(g1)).send({ code: created.body.joinCode }).expect(201);
    await http().post('/join').set(as(g2)).send({ code: created.body.joinCode }).expect(201);

    // No limit: guests have no allowance number.
    const unlimited = await http().patch(`/events/${eventId}`).set(as(h)).send({ guestPhotoLimit: null }).expect(200);
    expect(unlimited.body.guestPhotoLimit).toBeNull();
    expect((await http().get(`/events/${eventId}`).set(as(g1))).body.photoLimit).toBeNull();

    // Review first: a guest's photo waits for the host; its taker still sees it, others don't.
    await http().patch(`/events/${eventId}`).set(as(h)).send({ requireReview: true }).expect(200);
    const waiting = await upload(g1, { prompt: 'The first look' });
    expect(await album(g1)).toContain(waiting);
    expect(await album(g2)).not.toContain(waiting);
    expect(await album(h, 'review')).toEqual([waiting]);
    await http().get(`/events/${eventId}/photos?filter=review`).set(as(g1)).expect(403);
    expect((await http().get(`/events/${eventId}`).set(as(h))).body.pendingReviewCount).toBe(1);
    await http().patch(`/photos/${waiting}`).set(as(g1)).send({ approved: true }).expect(403);
    const approved = await http().patch(`/photos/${waiting}`).set(as(h)).send({ approved: true }).expect(200);
    expect(approved.body).toMatchObject({ pendingReview: false, prompt: 'The first look', uploader: { role: 'member' } });
    expect(await album(g2)).toContain(waiting);

    // Album opens later: until then guests see only their own photos.
    const later = new Date(Date.now() + 3_600_000).toISOString();
    const locked = await http().patch(`/events/${eventId}`).set(as(h)).send({ revealMode: 'morning', albumOpensAt: later }).expect(200);
    expect(locked.body.albumOpen).toBe(true); // the host always sees it
    expect((await http().get(`/events/${eventId}`).set(as(g2))).body.albumOpen).toBe(false);
    expect(await album(g2)).toEqual([]);
    expect(await album(g1)).toEqual([waiting]);
    await http().get(`/photos/${waiting}/download`).set(as(g2)).expect(404);
    await http().patch(`/events/${eventId}`).set(as(h)).send({ revealMode: 'live' }).expect(200);
    expect(await album(g2)).toContain(waiting);

    // Camera roll off: guests can only shoot with the camera.
    await http().patch(`/events/${eventId}`).set(as(h)).send({ allowLibraryUploads: false, requireReview: false }).expect(200);
    const blocked = await http()
      .post(`/events/${eventId}/photos/uploads`)
      .set(as(g2))
      .send({ clientUploadId: randomUUID(), contentType: 'image/jpeg', byteSize: original.length, thumbByteSize: thumb.length, source: 'library' })
      .expect(403);
    expect(blocked.body.code).toBe('LIBRARY_UPLOADS_OFF');
    const own = await upload(g2);

    // Saving off: guests can't save others' photos, but can save their own; the host always can.
    await http().patch(`/events/${eventId}`).set(as(h)).send({ allowDownloads: false }).expect(200);
    expect((await http().get(`/photos/${waiting}/download`).set(as(g2)).expect(403)).body.code).toBe('DOWNLOADS_OFF');
    await http().get(`/photos/${own}/download`).set(as(g2)).expect(200);
    await http().get(`/photos/${waiting}/download`).set(as(h)).expect(200);

    // Likes: one per person.
    await http().put(`/photos/${waiting}/like`).set(as(g2)).expect(200);
    expect((await http().put(`/photos/${waiting}/like`).set(as(h)).expect(200)).body).toEqual({ likeCount: 2, likedByMe: true });
    expect((await http().delete(`/photos/${waiting}/like`).set(as(h)).expect(200)).body).toEqual({ likeCount: 1, likedByMe: false });
    const listed = (await http().get(`/events/${eventId}/photos`).set(as(g2))).body.items.find((p: { id: string }) => p.id === waiting);
    expect(listed).toMatchObject({ likeCount: 1, likedByMe: true });

    // At most 3 photographers.
    const ids: string[] = [];
    for (const u of ['ph1', 'ph2', 'ph3', 'ph4'].map((n) => `${n}${run}`)) {
      await http().post('/join').set(as(u)).send({ code: created.body.joinCode }).expect(201);
      ids.push((await http().get('/me').set(as(u))).body.id);
    }
    for (const id of ids.slice(0, 3)) await http().patch(`/events/${eventId}/members/${id}`).set(as(h)).send({ role: 'photographer' }).expect(200);
    const full = await http().patch(`/events/${eventId}/members/${ids[3]}`).set(as(h)).send({ role: 'photographer' }).expect(409);
    expect(full.body.code).toBe('PHOTOGRAPHER_SLOTS_FULL');
    const preview = await http().get(`/join/${created.body.joinCode}`).set(as(`late2${run}`)).expect(200);
    expect(preview.body).toMatchObject({ name: 'Tanya and Paul', type: 'wedding', tagline: 'Shoot everything.', guestPhotoLimit: null });
    expect(preview.body.photographers).toHaveLength(3);
    expect(await album(g2, 'photographers')).toEqual([]);
    expect(await album(g2, 'guests')).toEqual(expect.arrayContaining([waiting, own]));
    expect(await album(g2, 'mine')).toEqual([own]);

    // Download all: host only; originals in a ZIP with a folder per person.
    await http().get(`/events/${eventId}/archive`).set(as(g2)).expect(403);
    const summary = await http().get(`/events/${eventId}/archive`).set(as(h)).expect(200);
    expect(summary.body.all.count).toBe(2);
    expect(summary.body.all.bytes).toBe(2 * original.length);
    expect(summary.body.photographers.count).toBe(0);
    await http().post(`/events/${eventId}/archive`).set(as(h)).send({ scope: 'photographers' }).expect(404);
    // Built in the background: ask until it's ready.
    const ready = async () => {
      for (let i = 0; i < 50; i++) {
        const res = await http().post(`/events/${eventId}/archive`).set(as(h)).send({ scope: 'all' }).expect(201);
        if (res.body.status === 'ready') return res.body as { url: string; count: number; bytes: number };
        expect(res.body.status).toBe('building');
        await new Promise((done) => setTimeout(done, 200));
      }
      throw new Error('ZIP never got ready');
    };
    const zipKey = (url: string) => new URL(url).pathname;
    const archive = await ready();
    expect(archive).toMatchObject({ count: 2, bytes: 2 * original.length });
    const zip = Buffer.from(await (await fetch(archive.url)).arrayBuffer());
    expect(zip.subarray(0, 2).toString()).toBe('PK');
    expect(zip.length).toBeGreaterThan(2 * original.length); // stored, not recompressed
    expect(zip.includes(Buffer.from(`Wedg1${run}/001 `))).toBe(true); // dev users are named after their handle
    expect(zip.includes(original)).toBe(true); // the original's bytes, untouched

    // Photos unchanged: the same ZIP again. A new photo: a new ZIP, and the old one is deleted.
    expect(zipKey((await ready()).url)).toBe(zipKey(archive.url));
    await upload(g1);
    const after = await ready();
    expect(after.count).toBe(3);
    expect(zipKey(after.url)).not.toBe(zipKey(archive.url));
    const storage = app.get(StorageService);
    const oldKey = decodeURIComponent(zipKey(archive.url)).replace(/^\/[^/]+\//, ''); // drop the bucket
    for (let i = 0; i < 20 && (await storage.head(oldKey)); i++) await new Promise((done) => setTimeout(done, 100));
    expect(await storage.head(oldKey)).toBeNull();
  });

  it('signs up and logs in with email + password', async () => {
    const http = () => request(app.getHttpServer());
    const email = `Riya.${run}@Example.com`;
    const password = 'correct horse battery';

    const signup = await http().post('/auth/signup').send({ name: 'Riya Sharma', email, password }).expect(201);
    expect(signup.body.user).toMatchObject({ name: 'Riya Sharma', email: email.toLowerCase() });
    expect(JSON.stringify(signup.body)).not.toContain('argon2'); // the hash never leaves the server

    // The token works on protected routes.
    const me = await http().get('/me').set('Authorization', `Bearer ${signup.body.token}`).expect(200);
    expect(me.body.id).toBe(signup.body.user.id);

    // One account per email (case-insensitive).
    await http().post('/auth/signup').send({ name: 'Copy', email: email.toUpperCase(), password }).expect(409);
    await http().post('/auth/signup').send({ name: 'Short', email: `s${run}@example.com`, password: 'short' }).expect(400);

    const login = await http().post('/auth/login').send({ email: email.toLowerCase(), password }).expect(200);
    expect(login.body.user.id).toBe(signup.body.user.id);

    // Wrong password and unknown email get the same answer.
    const wrong = await http().post('/auth/login').send({ email, password: 'nope nope nope' }).expect(401);
    const unknown = await http().post('/auth/login').send({ email: `nobody${run}@example.com`, password }).expect(401);
    expect(wrong.body.message).toBe(unknown.body.message);

    // Tampered or garbage tokens are rejected.
    const tampered = `${login.body.token.slice(0, -4)}AAAA`;
    await http().get('/me').set('Authorization', `Bearer ${tampered}`).expect(401);
    await http().get('/me').set('Authorization', 'Bearer abc.def.ghi').expect(401);
  });

  it('rejects bad input and missing auth', async () => {
    await request(app.getHttpServer()).post('/events').set(as(host)).send({ name: 'x' }).expect(400);
    await request(app.getHttpServer()).get('/events').expect(401);
  });
});
