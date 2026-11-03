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

    // Outsiders and guests are kept in their lane.
    await http().get(`/events/${eventId}/photos`).set(as(outsider)).expect(404);
    await http().patch(`/photos/${photoId}`).set(as(guest)).send({ visibility: 'hidden' }).expect(403);

    // Host hides it: guests stop seeing it, the host still does.
    await http().patch(`/photos/${photoId}`).set(as(host)).send({ visibility: 'hidden' }).expect(200);
    expect((await http().get(`/events/${eventId}/photos`).set(as(guest))).body.items).toHaveLength(0);
    expect((await http().get(`/events/${eventId}/photos`).set(as(host))).body.items).toHaveLength(1);

    // Host removes the guest: access gone, and the code no longer lets them back in.
    const guestId = (await http().get('/me').set(as(guest))).body.id as string;
    await http().delete(`/events/${eventId}/members/${guestId}`).set(as(host)).expect(204);
    await http().get(`/events/${eventId}/photos`).set(as(guest)).expect(404);
    await http().post('/join').set(as(guest)).send({ code: joinCode }).expect(403);
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
