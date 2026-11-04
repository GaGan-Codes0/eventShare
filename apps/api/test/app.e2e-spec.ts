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
    const created = await http().post('/events').set(as(host2)).send({ name: 'Sangeet', guestPhotoLimit: 40 }).expect(201);
    eventId = created.body.id;
    expect(created.body).toMatchObject({ guestPhotoLimit: 40, photoLimit: 500, photosUsed: 0 });

    // Only the host changes the guest allowance, and only to 20, 40 or 60.
    const joined = await http().post('/join').set(as(shooter)).send({ code: created.body.joinCode }).expect(201);
    expect(joined.body).toMatchObject({ role: 'member', photoLimit: 40 });
    await http().patch(`/events/${eventId}`).set(as(shooter)).send({ guestPhotoLimit: 60 }).expect(403);
    await http().patch(`/events/${eventId}`).set(as(host2)).send({ guestPhotoLimit: 50 }).expect(400);
    await http().patch(`/events/${eventId}`).set(as(host2)).send({ guestPhotoLimit: 20 }).expect(200);

    // 18 photos, then 5 at once with 2 slots left: exactly 2 get through.
    for (let i = 0; i < 18; i++) await startUpload(shooter).expect(201);
    const burst = await Promise.all(Array.from({ length: 5 }, () => startUpload(shooter)));
    expect(burst.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 201, 403, 403, 403]);
    expect(burst.find((r) => r.status === 403)!.body).toMatchObject({
      code: 'PHOTO_LIMIT_REACHED',
      message: "You've used all 20 of your photos for this event",
    });

    // A photo that already has its slot can still be retried at the limit; a new one can't.
    const kept = randomUUID();
    await http().patch(`/events/${eventId}`).set(as(host2)).send({ guestPhotoLimit: 40 }).expect(200);
    await startUpload(shooter, kept).expect(201);
    await http().patch(`/events/${eventId}`).set(as(host2)).send({ guestPhotoLimit: 20 }).expect(200);
    await startUpload(shooter, kept).expect(201);
    await startUpload(shooter).expect(403);

    // Promoted to photographer: 500 photos, listed right after the host.
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
    expect(promoted.body).toMatchObject({ role: 'photographer', photosUsed: 21 });
    await startUpload(shooter).expect(201);
    const asShooter = await http().get(`/events/${eventId}`).set(as(shooter)).expect(200);
    expect(asShooter.body).toMatchObject({ role: 'photographer', photoLimit: 500, photosUsed: 22 });
    const members = await http().get(`/events/${eventId}/members`).set(as(host2)).expect(200);
    expect(members.body.map((m: { role: string }) => m.role)).toEqual(['host', 'photographer']);

    // Photographers still can't moderate other people's photos.
    const hostPhoto = await startUpload(host2).expect(201);
    await http().patch(`/photos/${hostPhoto.body.photoId}`).set(as(shooter)).send({ visibility: 'hidden' }).expect(403);
    await http().delete(`/photos/${hostPhoto.body.photoId}`).set(as(shooter)).expect(403);

    // Back to guest: already over the guest allowance, so no more photos.
    await http().patch(`/events/${eventId}/members/${shooterId}`).set(as(host2)).send({ role: 'member' }).expect(200);
    await startUpload(shooter).expect(403);
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
