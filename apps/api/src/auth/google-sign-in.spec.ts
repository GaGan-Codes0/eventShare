import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { generateKeyPair, SignJWT } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '../config/env.js';
import type { Db } from '../db/db.module.js';
import type { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

// Stand-in for Google's signing keys, so tokens can be made here without the network.
const keys = vi.hoisted(() => import('jose').then((j) => j.generateKeyPair('RS256')));
vi.mock('jose', async (importOriginal) => {
  const jose = await importOriginal<typeof import('jose')>();
  return { ...jose, createRemoteJWKSet: () => async () => (await keys).publicKey };
});

const WEB = 'web-client.apps.googleusercontent.com';
const env = { JWT_SECRET: 'x'.repeat(40), JWT_TTL: '30d', GOOGLE_CLIENT_IDS: [WEB] } as unknown as Env;

async function googleToken(claims: Record<string, unknown>, { aud = WEB, iss = 'https://accounts.google.com', key }: { aud?: string; iss?: string; key?: CryptoKey } = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(iss)
    .setAudience(aud)
    .setSubject('1234567890')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key ?? (await keys).privateKey);
}

describe('Sign in with Google', () => {
  let created: { authId: string; name: string; email: string | null } | null;
  let auth: AuthService;

  beforeEach(() => {
    created = null;
    const db = { query: { users: { findFirst: vi.fn().mockResolvedValue(undefined) } } } as unknown as Db;
    const users = {
      findOrCreate: vi.fn(async (authId: string, make: () => Promise<{ name: string; email: string | null }>) => {
        created = { authId, ...(await make()) };
        return { id: 'u1', ...created, avatarUrl: null, deletedAt: null };
      }),
      toDto: (u: { id: string; name: string }) => ({ id: u.id, name: u.name }),
    } as unknown as UsersService;
    auth = new AuthService(env, db, users);
  });

  it('is refused until client IDs are set', async () => {
    const off = new AuthService({ ...env, GOOGLE_CLIENT_IDS: [] } as unknown as Env, {} as Db, {} as UsersService);
    await expect(off.signInWithGoogle({ idToken: await googleToken({}) })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("signs in with Google's verified email and name", async () => {
    const session = await auth.signInWithGoogle({ idToken: await googleToken({ email: 'Asha@Gmail.com', email_verified: true, name: 'Asha Rao' }) });
    expect(session.token).toBeTruthy();
    expect(created).toMatchObject({ authId: 'google_1234567890', name: 'Asha Rao', email: 'asha@gmail.com' });
  });

  it('ignores an email Google has not verified', async () => {
    await auth.signInWithGoogle({ idToken: await googleToken({ email: 'someone@example.com', email_verified: false }) });
    expect(created?.email).toBeNull();
  });

  it('rejects tokens for another app, from another issuer, or signed by someone else', async () => {
    const stranger = (await generateKeyPair('RS256')).privateKey;
    for (const idToken of [
      await googleToken({}, { aud: 'someone-else.apps.googleusercontent.com' }),
      await googleToken({}, { iss: 'https://evil.example.com' }),
      await googleToken({}, { key: stranger }),
      'not-a-token-at-all-xxxxxxxx',
    ]) {
      await expect(auth.signInWithGoogle({ idToken })).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });
});
