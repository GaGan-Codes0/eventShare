/**
 * Core flow, end to end, against the local stack (`docker compose up -d` + apps/api/.env with
 * AUTH_DEV_BYPASS=true): create → join → upload → gallery → permissions.
 */
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { WebSocket } from 'ws';

import { AppModule } from './../src/app.module.js';
import { PhotosService } from './../src/photos/photos.service.js';
import { RealtimeGateway } from './../src/realtime/realtime.gateway.js';
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
    app.get(RealtimeGateway).attach(app.getHttpServer() as unknown as Server);
    await app.listen(0);
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

    // Codes are 6 digits; spaces and dashes don't matter.
    expect(joinCode).toMatch(/^\d{6}$/);
    const loose = `${joinCode.slice(0, 3)} ${joinCode.slice(3)}`;
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
    expect(created.body).toMatchObject({ guestPhotoLimit: 24, photoLimit: null, photosUsed: 0 });

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

  it('invites photographers by email: slots, joining as photographer, cancelling', async () => {
    const http = () => request(app.getHttpServer());
    const password = 'correct horse battery';
    const account = async (name: string) => {
      const email = `${name.toLowerCase()}.${run}@example.com`;
      const res = await http().post('/auth/signup').send({ name, email, password }).expect(201);
      return { email, auth: { Authorization: `Bearer ${res.body.token}` } };
    };
    const kabir = await account('Kabir'); // invited before he has joined
    const meera = await account('Meera'); // already a guest when invited

    const created = await http().post('/events').set(as(host)).send({ name: 'Invite test', location: 'Goa' }).expect(201);
    const { id: eventId, joinCode } = created.body as { id: string; joinCode: string };
    const invites = `/events/${eventId}/photographer-invites`;
    const slots = async () => (await http().get(`/events/${eventId}`).set(as(host)).expect(200)).body.photographerCount as number;

    // Invite by email (stored lowercased); it takes a slot at once.
    const first = await http().post(invites).set(as(host)).send({ name: 'Kabir', email: kabir.email.toUpperCase() }).expect(201);
    // No mail service in tests: the invite holds, marked as not emailed.
    expect(first.body).toMatchObject({ status: 'invited', invite: { name: 'Kabir', email: kabir.email, emailed: false } });
    expect(await slots()).toBe(1);
    await http().post(invites).set(as(host)).send({ name: 'Kabir again', email: kabir.email }).expect(409);
    await http().post(invites).set(as(host)).send({ name: 'No email', email: 'not-an-email' }).expect(400);

    // Someone already in the event becomes the photographer straight away.
    await http().post('/join').set(meera.auth).send({ code: joinCode }).expect(201);
    const second = await http().post(invites).set(as(host)).send({ name: 'Meera', email: meera.email }).expect(201);
    expect(second.body).toMatchObject({ status: 'joined', member: { name: 'Meera', role: 'photographer' } });
    expect(await slots()).toBe(2);

    // The third slot can be an invite too; a fourth is refused until one frees up.
    const third = await http().post(invites).set(as(host)).send({ name: 'Ishita', email: `ishita.${run}@example.com` }).expect(201);
    const full = await http().post(invites).set(as(host)).send({ name: 'Farhan', email: `farhan.${run}@example.com` }).expect(409);
    expect(full.body.code).toBe('PHOTOGRAPHER_SLOTS_FULL');
    await http().delete(`${invites}/${third.body.invite.id}`).set(as(host)).expect(204);
    await http().delete(`${invites}/${third.body.invite.id}`).set(as(host)).expect(404);
    expect(await slots()).toBe(2);

    // Only the host manages invites.
    await http().get(invites).set(meera.auth).expect(403);
    const open = await http().get(invites).set(as(host)).expect(200);
    expect(open.body.map((i: { email: string }) => i.email)).toEqual([kabir.email]);

    // Kabir joins with the code and comes in as the photographer; his invite is used up.
    const joined = await http().post('/join').set(kabir.auth).send({ code: joinCode }).expect(201);
    expect(joined.body.role).toBe('photographer');
    expect((await http().get(invites).set(as(host)).expect(200)).body).toEqual([]);
    expect(await slots()).toBe(2);

    // The host sees members' emails; guests don't.
    const forHost = await http().get(`/events/${eventId}/members`).set(as(host)).expect(200);
    expect(forHost.body.find((m: { name: string }) => m.name === 'Kabir')).toMatchObject({ role: 'photographer', email: kabir.email });
    const forMeera = await http().get(`/events/${eventId}/members`).set(meera.auth).expect(200);
    expect(forMeera.body.every((m: { email?: string }) => m.email === undefined)).toBe(true);
  });

  it('takes videos and voice notes, within their own time limits, checked against the file', async () => {
    const http = () => request(app.getHttpServer());
    const box = (type: string, body: Buffer) => {
      const head = Buffer.alloc(8);
      head.writeUInt32BE(8 + body.length, 0);
      head.write(type, 4, 'latin1');
      return Buffer.concat([head, body]);
    };
    /** A tiny but well-formed MP4 / M4A whose movie header says it lasts `ms`, with moov after mdat (as phones write it). */
    const media = (ms: number, brand = 'isom') => {
      const mvhd = Buffer.alloc(100);
      mvhd.writeUInt32BE(1000, 12); // timescale: 1 unit = 1 ms
      mvhd.writeUInt32BE(ms, 16);
      return Buffer.concat([box('ftyp', Buffer.from(`${brand}\0\0\0\0`, 'latin1')), box('mdat', Buffer.alloc(4096, 7)), box('moov', box('mvhd', mvhd))]);
    };
    const created = await http().post('/events').set(as(host)).send({ name: 'Video test', location: 'Pune' }).expect(201);
    const { id: eventId, joinCode } = created.body as { id: string; joinCode: string };
    const g = `vid${run}`;
    await http().post('/join').set(as(g)).send({ code: joinCode }).expect(201);
    const used = async () => {
      const e = (await http().get(`/events/${eventId}`).set(as(g)).expect(200)).body;
      return { video: e.videoMsUsed, voice: e.voiceMsUsed, photos: e.photosUsed, videoLimit: e.videoLimitMs, voiceLimit: e.voiceLimitMs };
    };
    const send = async (kind: 'video' | 'voice', file: Buffer, reportedMs: number, contentType: string, expectStatus = 201) => {
      const body = {
        clientUploadId: randomUUID(),
        kind,
        contentType,
        byteSize: file.length,
        durationMs: reportedMs,
        ...(kind === 'video' && { thumbByteSize: thumb.length }),
      };
      const ticket = await http().post(`/events/${eventId}/photos/uploads`).set(as(g)).send(body).expect(expectStatus);
      if (expectStatus !== 201) return ticket;
      for (const [target, bytes] of [
        [ticket.body.original, file],
        [ticket.body.thumb, thumb],
      ] as const) {
        if (target) await fetch(target.url, { method: 'PUT', headers: target.headers, body: new Uint8Array(bytes) });
      }
      return http().post(`/photos/${ticket.body.photoId}/complete`).set(as(g));
    };

    expect(await used()).toEqual({ video: 0, voice: 0, photos: 0, videoLimit: 300_000, voiceLimit: 60_000 });

    // A one-minute video: ready, with its length, and it doesn't use a photo shot.
    const one = await send('video', media(60_000), 60_000, 'video/mp4');
    expect(one.status).toBe(201);
    expect(one.body).toMatchObject({ kind: 'video', durationMs: 60_000, status: 'ready' });
    expect(one.body.thumbUrl).toBeTruthy();
    expect(await used()).toMatchObject({ video: 60_000, photos: 0 });

    // Claims 10 s but the file is 250 s long: past the 5 minutes, so it's refused and the time comes back.
    const liar = await send('video', media(250_000), 10_000, 'video/quicktime');
    expect(liar.status).toBe(403);
    expect(liar.body.code).toBe('VIDEO_LIMIT_REACHED');
    expect((await used()).video).toBe(60_000);

    // Asking for more than is left is refused up front.
    const tooLong = await send('video', media(241_000), 241_000, 'video/mp4', 403);
    expect(tooLong.body.code).toBe('VIDEO_LIMIT_REACHED');

    // Voice notes: no thumbnail, their own minute, shared across all of a person's notes.
    const v1 = await send('voice', media(40_000, 'M4A '), 40_000, 'audio/mp4');
    expect(v1.body).toMatchObject({ kind: 'voice', durationMs: 40_000, thumbUrl: null });
    const v2 = await send('voice', media(30_000, 'M4A '), 30_000, 'audio/x-m4a', 403);
    expect(v2.body.code).toBe('VOICE_LIMIT_REACHED');
    expect(await used()).toMatchObject({ video: 60_000, voice: 40_000, photos: 0 });

    // The wrong kind of file for the kind is rejected.
    await http()
      .post(`/events/${eventId}/photos/uploads`)
      .set(as(g))
      .send({ clientUploadId: randomUUID(), kind: 'voice', contentType: 'video/mp4', byteSize: 10, durationMs: 1000 })
      .expect(400);

    // Both show in the album with everyone else's photos.
    const album = await http().get(`/events/${eventId}/photos`).set(as(host)).expect(200);
    expect(album.body.items.map((p: { kind: string }) => p.kind).sort()).toEqual(['video', 'voice']);
  });

  it('finds my photos from faceprints the phones made, only with consent and the host switch on', async () => {
    const http = () => request(app.getHttpServer());
    const MODEL = 'sface-2021dec-int8';
    // Stand-ins for faceprints: one direction per person, a little noise per photo.
    const rand = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
    const person = (seed: number) => Array.from({ length: 128 }, rand(seed));
    const noisy = (v: number[], n: number) => {
      const r = rand(1000 + n);
      return v.map((x) => x + r() * 0.3);
    };
    const asha = person(1);
    const dev = person(2);

    const created = await http().post('/events').set(as(host)).send({ name: 'Faces test', location: 'Delhi' }).expect(201);
    const { id: eventId, joinCode } = created.body as { id: string; joinCode: string };
    const g = `face${run}`;
    await http().post('/join').set(as(g)).send({ code: joinCode }).expect(201);

    const upload = async (who: string) => {
      const t = await http()
        .post(`/events/${eventId}/photos/uploads`)
        .set(as(who))
        .send({ clientUploadId: randomUUID(), contentType: 'image/jpeg', byteSize: original.length, thumbByteSize: thumb.length })
        .expect(201);
      for (const [target, bytes] of [
        [t.body.original, original],
        [t.body.thumb, thumb],
      ] as const)
        await fetch(target.url, { method: 'PUT', headers: target.headers, body: new Uint8Array(bytes) });
      await http().post(`/photos/${t.body.photoId}/complete`).set(as(who)).expect(201);
      return t.body.photoId as string;
    };
    const both = await upload(host); // Asha and Dev
    const devOnly = await upload(host); // Dev
    const ashaOnly = await upload(g); // Asha, taken by the guest
    const older = await upload(host); // no faces sent yet

    const faces = (prints: number[][]) => ({ model: MODEL, faces: prints.map((embedding, i) => ({ box: [0.1 * i, 0.1, 0.2, 0.3], embedding })) });
    await http().put(`/photos/${both}/faces`).set(as(host)).send(faces([noisy(asha, 1), noisy(dev, 2)])).expect(200);
    await http().put(`/photos/${devOnly}/faces`).set(as(host)).send(faces([noisy(dev, 3)])).expect(200);
    await http().put(`/photos/${ashaOnly}/faces`).set(as(g)).send(faces([noisy(asha, 4)])).expect(200);
    // Only the uploader (or the host) can say what's in a photo; prints must be the right size.
    await http().put(`/photos/${both}/faces`).set(as(g)).send(faces([asha])).expect(403);
    await http().put(`/photos/${both}/faces`).set(as(host)).send({ model: MODEL, faces: [{ box: [0, 0, 1, 1], embedding: [1, 2, 3] }] }).expect(400);

    // On by default; while the host has it off, nobody can opt in.
    expect((await http().get(`/events/${eventId}`).set(as(g)).expect(200)).body.findMyPhotos).toBe(true);
    await http().patch(`/events/${eventId}`).set(as(host)).send({ findMyPhotos: false }).expect(200);
    await http().put(`/events/${eventId}/face-profile`).set(as(g)).send({ model: MODEL, embedding: asha, consent: true }).expect(403);
    await http().patch(`/events/${eventId}`).set(as(host)).send({ findMyPhotos: true }).expect(200);
    // The host's phone is handed the older photos to look at.
    const pending = await http().get(`/events/${eventId}/faces/pending`).set(as(host)).expect(200);
    expect(pending.body.map((p: { id: string }) => p.id)).toEqual([older]);
    await http().get(`/events/${eventId}/faces/pending`).set(as(g)).expect(403);

    // Consent is required; then the guest's selfie finds the photos Asha is in, and not Dev's.
    await http().put(`/events/${eventId}/face-profile`).set(as(g)).send({ model: MODEL, embedding: asha }).expect(400);
    await http().put(`/events/${eventId}/face-profile`).set(as(g)).send({ model: MODEL, embedding: noisy(asha, 9), consent: true }).expect(204);
    expect((await http().get(`/events/${eventId}`).set(as(g)).expect(200)).body.hasFaceProfile).toBe(true);
    const mine = await http().get(`/events/${eventId}/photos?filter=me`).set(as(g)).expect(200);
    expect(mine.body.items.map((p: { id: string }) => p.id).sort()).toEqual([both, ashaOnly].sort());

    // Opting out, or the host switching it off, deletes the print.
    await http().delete(`/events/${eventId}/face-profile`).set(as(g)).expect(204);
    expect((await http().get(`/events/${eventId}/photos?filter=me`).set(as(g)).expect(200)).body.items).toEqual([]);
    await http().put(`/events/${eventId}/face-profile`).set(as(g)).send({ model: MODEL, embedding: asha, consent: true }).expect(204);
    await http().patch(`/events/${eventId}`).set(as(host)).send({ findMyPhotos: false }).expect(200);
    expect((await http().get(`/events/${eventId}`).set(as(g)).expect(200)).body.hasFaceProfile).toBe(false);
  });

  it('pushes live updates, serves just the newest photos, and takes down a fake thumbnail', async () => {
    const http = () => request(app.getHttpServer());
    const email = `live${run}@example.com`;
    const signup = await http().post('/auth/signup').send({ name: 'Live Host', email, password: 'correct-horse-battery' }).expect(201);
    const auth = { Authorization: `Bearer ${signup.body.token}` };
    const created = await http().post('/events').set(auth).send({ name: 'Live test', location: 'Delhi' }).expect(201);
    const eventId = created.body.id as string;
    const before = (await http().get(`/events/${eventId}/live`).set(auth).expect(200)).body as { new: number; rev: number };

    const port = ((app.getHttpServer() as unknown as Server).address() as AddressInfo).port;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/realtime`);
    const messages: { t: string; eventId: string; live: { new: number; rev: number } }[] = [];
    ws.on('message', (m) => messages.push(JSON.parse(m.toString())));
    await new Promise((resolve) => ws.once('open', resolve));
    ws.send(JSON.stringify({ t: 'auth', token: signup.body.token }));
    await new Promise((r) => setTimeout(r, 150));
    ws.send(JSON.stringify({ t: 'watch', eventId }));
    await vi.waitFor(() => expect(messages.length).toBe(1));
    expect(messages[0]).toMatchObject({ t: 'live', eventId, live: before });

    const upload = async (thumbBytes: Buffer) => {
      const t = await http()
        .post(`/events/${eventId}/photos/uploads`)
        .set(auth)
        .send({ clientUploadId: randomUUID(), contentType: 'image/jpeg', byteSize: original.length, thumbByteSize: thumbBytes.length })
        .expect(201);
      for (const [target, bytes] of [
        [t.body.original, original],
        [t.body.thumb, thumbBytes],
      ] as const)
        await fetch(target.url, { method: 'PUT', headers: target.headers, body: new Uint8Array(bytes) });
      await http().post(`/photos/${t.body.photoId}/complete`).set(auth).expect(201);
      return t.body.photoId as string;
    };

    // A burst of photos: one push, carrying the new total.
    const ids = [await upload(thumb), await upload(thumb), await upload(thumb)];
    await vi.waitFor(() => expect(messages.at(-1)?.live.new).toBe(before.new + 3), { timeout: 8000, interval: 100 });
    expect(messages.length).toBeLessThanOrEqual(3);

    // Just the newest, for a live refresh; and the same signed link each time, so phones can cache it.
    const head = await http().get(`/events/${eventId}/photos?limit=2`).set(auth).expect(200);
    expect(head.body.items).toHaveLength(2);
    expect(head.body.nextCursor).toBeTruthy();
    const again = await http().get(`/events/${eventId}/photos?limit=2`).set(auth).expect(200);
    expect(again.body.items[0].thumbUrl).toBe(head.body.items[0].thumbUrl);

    // Not an image: accepted at once, then taken down by the background check.
    const fake = await upload(Buffer.from('this is not an image'));
    await vi.waitFor(
      async () => {
        const list = await http().get(`/events/${eventId}/photos`).set(auth).expect(200);
        expect(list.body.items.map((p: { id: string }) => p.id).sort()).toEqual([...ids].sort());
      },
      { timeout: 8000, interval: 200 },
    );
    expect(fake).toBeTruthy();

    // Outsiders can't watch an event.
    const other = await http().post('/auth/signup').send({ name: 'Outsider', email: `out${run}@example.com`, password: 'correct-horse-battery' }).expect(201);
    const ws2 = new WebSocket(`ws://127.0.0.1:${port}/realtime`);
    await new Promise((resolve) => ws2.once('open', resolve));
    ws2.send(JSON.stringify({ t: 'auth', token: other.body.token }));
    await new Promise((r) => setTimeout(r, 150));
    const closed = new Promise<number>((resolve) => ws2.once('close', resolve));
    ws2.send(JSON.stringify({ t: 'watch', eventId }));
    expect(await closed).toBe(4403);
    ws.close();
  }, 30_000);

  it('lets a guest out of shots ask for more, and the hosts give them', async () => {
    const http = () => request(app.getHttpServer());
    const created = await http().post('/events').set(as(host)).send({ name: 'Refill test', location: 'Delhi' }).expect(201);
    const { id: eventId, joinCode } = created.body as { id: string; joinCode: string };
    await http().patch(`/events/${eventId}`).set(as(host)).send({ guestPhotoLimit: 10 }).expect(200);
    const g = `refill${run}`;
    await http().post('/join').set(as(g)).send({ code: joinCode }).expect(201);
    const detail = async () => (await http().get(`/events/${eventId}`).set(as(g)).expect(200)).body as { refillStatus: string | null; photoLimit: number };
    const ticket = () =>
      http().post(`/events/${eventId}/photos/uploads`).set(as(g)).send({ clientUploadId: randomUUID(), contentType: 'image/jpeg', byteSize: original.length, thumbByteSize: thumb.length });

    for (let i = 0; i < 10; i++) await ticket().expect(201);
    await ticket().expect(403);

    // The host and other people can't use a guest's route or see the list.
    await http().post(`/events/${eventId}/refill-requests`).set(as(host)).expect(400);
    await http().get(`/events/${eventId}/refill-requests`).set(as(g)).expect(403);

    // Asking twice is one request; the host sees it.
    await http().post(`/events/${eventId}/refill-requests`).set(as(g)).expect(204);
    await http().post(`/events/${eventId}/refill-requests`).set(as(g)).expect(204);
    expect((await detail()).refillStatus).toBe('pending');
    expect((await http().get(`/events/${eventId}`).set(as(host)).expect(200)).body.pendingRefillCount).toBe(1);
    const list = await http().get(`/events/${eventId}/refill-requests`).set(as(host)).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ photosUsed: 10, photoLimit: 10 });
    const requestId = list.body[0].id as string;

    // Guests can't approve themselves, only the offered amounts work, and answering twice gives once.
    await http().post(`/events/${eventId}/refill-requests/${requestId}/approve`).set(as(g)).send({ shots: 24 }).expect(403);
    await http().post(`/events/${eventId}/refill-requests/${requestId}/approve`).set(as(host)).send({ shots: 7 }).expect(400);
    await http().post(`/events/${eventId}/refill-requests/${requestId}/approve`).set(as(host)).send({ shots: 5 }).expect(204);
    await http().post(`/events/${eventId}/refill-requests/${requestId}/approve`).set(as(host)).send({ shots: 5 }).expect(404);
    expect(await detail()).toMatchObject({ refillStatus: null, photoLimit: 15 });
    for (let i = 0; i < 5; i++) await ticket().expect(201);
    await ticket().expect(403);

    // "Not now": they have to wait before asking again.
    await http().post(`/events/${eventId}/refill-requests`).set(as(g)).expect(204);
    const again = await http().get(`/events/${eventId}/refill-requests`).set(as(host)).expect(200);
    await http().post(`/events/${eventId}/refill-requests/${again.body[0].id}/decline`).set(as(host)).expect(204);
    expect(await detail()).toMatchObject({ refillStatus: 'declined', photoLimit: 15 });
    await http().post(`/events/${eventId}/refill-requests`).set(as(g)).expect(409);
  }, 30_000);

  it('only takes new shots from the event day until 48 hours after it', async () => {
    const http = () => request(app.getHttpServer());
    const hours = (n: number) => new Date(Date.now() + n * 3_600_000).toISOString();
    const created = await http().post('/events').set(as(host)).send({ name: 'Window test', location: 'Delhi', startsAt: hours(72) }).expect(201);
    const { id: eventId, joinCode } = created.body as { id: string; joinCode: string };
    const g = `window${run}`;
    await http().post('/join').set(as(g)).send({ code: joinCode }).expect(201);
    const shoot = (user: string, extra: Record<string, unknown> = {}) =>
      http()
        .post(`/events/${eventId}/photos/uploads`)
        .set(as(user))
        .send({ clientUploadId: randomUUID(), contentType: 'image/jpeg', byteSize: original.length, thumbByteSize: thumb.length, ...extra });
    const moveTo = (n: number) => http().patch(`/events/${eventId}`).set(as(host)).send({ startsAt: hours(n) }).expect(200);

    // Before the event day: guests wait, the host can try it out.
    expect((await shoot(g).expect(403)).body.code).toBe('SHOOTING_NOT_OPEN');
    await shoot(host).expect(201);

    await moveTo(0);
    await shoot(g).expect(201);
    await moveTo(-59); // an hour before closing
    const stuck = { clientUploadId: randomUUID(), takenAt: hours(-2) };
    await shoot(g).expect(201);

    await moveTo(-61); // closed an hour ago, for the host too
    expect((await shoot(g).expect(403)).body.code).toBe('SHOOTING_CLOSED');
    expect((await shoot(host).expect(403)).body.code).toBe('SHOOTING_CLOSED');
    await shoot(g, { takenAt: hours(-0.5) }).expect(403); // taken after closing
    await shoot(g, stuck).expect(201); // taken in time, arrived late
    await shoot(g, stuck).expect(201); // and a retry of it is fine
    await http().post(`/events/${eventId}/refill-requests`).set(as(g)).expect(400);

    await moveTo(-86); // closed a day and more ago: even a stuck photo is too late
    await shoot(g, { takenAt: hours(-30) }).expect(403);
  });

  it('limits password guessing per account, not per Wi-Fi network', async () => {
    const http = () => request(app.getHttpServer());
    // A whole wedding on one IP: many different people can all sign in.
    for (let i = 0; i < 15; i++) {
      await http().post('/auth/login').send({ email: `door${i}-${run}@example.com`, password: 'wrong-password-here' }).expect(401);
    }
    // Guessing one person's password is stopped.
    const victim = `victim-${run}@example.com`;
    for (let i = 0; i < 10; i++) await http().post('/auth/login').send({ email: victim, password: 'wrong-password-here' }).expect(401);
    await http().post('/auth/login').send({ email: victim.toUpperCase(), password: 'wrong-password-here' }).expect(429);
  }, 30_000);

  it('serves a preview, finishes a sleeping phone\'s photo, and takes big files in pieces', async () => {
    const http = () => request(app.getHttpServer());
    const created = await http().post('/events').set(as(host)).send({ name: 'Pieces test', location: 'Delhi' }).expect(201);
    const eventId = created.body.id as string;
    const preview = await sharp(original).resize(1600).jpeg({ quality: 82 }).toBuffer();
    const put = (target: { url: string; headers: Record<string, string> }, bytes: Buffer) =>
      fetch(target.url, { method: 'PUT', headers: target.headers, body: new Uint8Array(bytes) });

    // The phone sends its files, then goes to sleep without saying it's done.
    const ticket = await http()
      .post(`/events/${eventId}/photos/uploads`)
      .set(as(host))
      .send({ clientUploadId: randomUUID(), contentType: 'image/jpeg', byteSize: original.length, thumbByteSize: thumb.length, previewByteSize: preview.length })
      .expect(201);
    expect(ticket.body.preview).toBeTruthy();
    await Promise.all([put(ticket.body.original, original), put(ticket.body.thumb, thumb), put(ticket.body.preview, preview)]);
    const svc = app.get(PhotosService) as unknown as { finishInBackground(id: string): Promise<void> };
    await svc.finishInBackground(ticket.body.photoId);
    const list = await http().get(`/events/${eventId}/photos`).set(as(host)).expect(200);
    expect(list.body.items).toHaveLength(1);
    const size = async (url: string) => (await (await fetch(url)).arrayBuffer()).byteLength;
    expect(await size(list.body.items[0].previewUrl)).toBe(preview.length);
    expect(await size(list.body.items[0].url)).toBe(original.length);
    // When it wakes up and says it's done, nothing changes.
    await http().post(`/photos/${ticket.body.photoId}/complete`).set(as(host)).expect(201);

    // Files still missing: the background check leaves the photo alone and tries again later.
    const early = await http()
      .post(`/events/${eventId}/photos/uploads`)
      .set(as(host))
      .send({ clientUploadId: randomUUID(), contentType: 'image/jpeg', byteSize: original.length, thumbByteSize: thumb.length })
      .expect(201);
    await expect(svc.finishInBackground(early.body.photoId)).rejects.toThrow('still uploading');

    // A big file: in pieces, and a retry keeps the pieces already sent.
    const big = Buffer.alloc(25 * 1024 * 1024, 7);
    const video = { clientUploadId: randomUUID(), kind: 'video', contentType: 'video/mp4', byteSize: big.length, durationMs: 1000, thumbByteSize: thumb.length, multipart: true };
    const first = await http().post(`/events/${eventId}/photos/uploads`).set(as(host)).send(video).expect(201);
    expect(first.body.original).toBeNull();
    expect(first.body.multipart.parts).toHaveLength(3);
    const again = await http().post(`/events/${eventId}/photos/uploads`).set(as(host)).send(video).expect(201);
    expect(again.body.multipart.uploadId).toBe(first.body.multipart.uploadId);

    const { partBytes, parts: links } = again.body.multipart as { partBytes: number; parts: { number: number; url: string }[] };
    await put(again.body.thumb, thumb);
    const parts = [];
    for (const link of links) {
      const res = await fetch(link.url, { method: 'PUT', body: new Uint8Array(big.subarray((link.number - 1) * partBytes, link.number * partBytes)) });
      expect(res.status).toBe(200);
      parts.push({ number: link.number, etag: res.headers.get('etag')! });
    }
    // Missing a piece: refused, nothing lost.
    await http().post(`/photos/${first.body.photoId}/complete`).set(as(host)).send({ parts: parts.slice(1) }).expect(400);
    await http().post(`/photos/${first.body.photoId}/complete`).set(as(host)).send({ parts }).expect(201);
    const after = await http().get(`/events/${eventId}/photos`).set(as(host)).expect(200);
    const item = after.body.items.find((p: { id: string }) => p.id === first.body.photoId);
    expect(await size(item.url)).toBe(big.length);

    // A phone asleep with every piece delivered: the server joins them and puts the video live.
    const asleepTicket = await http().post(`/events/${eventId}/photos/uploads`).set(as(host)).send({ ...video, clientUploadId: randomUUID() }).expect(201);
    await put(asleepTicket.body.thumb, thumb);
    const pieces = asleepTicket.body.multipart.parts as { number: number; url: string }[];
    const send = (link: { number: number; url: string }) =>
      fetch(link.url, { method: 'PUT', body: new Uint8Array(big.subarray((link.number - 1) * partBytes, link.number * partBytes)) });
    await send(pieces[0]!);
    await expect(svc.finishInBackground(asleepTicket.body.photoId)).rejects.toThrow('still uploading');
    await Promise.all(pieces.slice(1).map(send));
    await svc.finishInBackground(asleepTicket.body.photoId);
    const live = await http().get(`/events/${eventId}/photos`).set(as(host)).expect(200);
    const asleep = live.body.items.find((p: { id: string }) => p.id === asleepTicket.body.photoId);
    expect(await size(asleep.url)).toBe(big.length);
    // Waking up afterwards changes nothing.
    await http().post(`/photos/${asleepTicket.body.photoId}/complete`).set(as(host)).send({ parts: [] }).expect(201);

    // Older app builds, which can't send pieces, still get one link.
    const old = await http().post(`/events/${eventId}/photos/uploads`).set(as(host)).send({ ...video, clientUploadId: randomUUID(), multipart: undefined }).expect(201);
    expect(old.body.original).toBeTruthy();
    expect(old.body.multipart).toBeNull();
  }, 60_000);

  it('rejects bad input and missing auth', async () => {
    await request(app.getHttpServer()).post('/events').set(as(host)).send({ name: 'x' }).expect(400);
    await request(app.getHttpServer()).get('/events').expect(401);
  });
});
