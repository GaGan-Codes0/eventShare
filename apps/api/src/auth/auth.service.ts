import { ConflictException, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { AppleSignInInput, AuthSession, GoogleSignInInput, LoginInput, SignupInput } from '@eventshare/shared';
import { hash, verify } from '@node-rs/argon2';
import { and, eq, isNull } from 'drizzle-orm';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { createHash, randomUUID } from 'node:crypto';

import { ENV, type Env } from '../config/env.js';
import { DB, type Db } from '../db/db.module.js';
import { users } from '../db/schema.js';
import { UsersService } from '../users/users.service.js';

const ISSUER = 'eventshare-api';
const AUDIENCE = 'eventshare-app';
const BAD_LOGIN = 'Email or password is incorrect';
const APPLE_ISSUER = 'https://appleid.apple.com';
/** Apple's signing keys, fetched once and cached (jose refreshes them when Apple rotates). */
const appleKeys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
/** Google's signing keys, cached the same way. */
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

/**
 * Our own email + password accounts. Passwords are hashed with argon2id (OWASP defaults);
 * a login returns a signed JWT (HS256) whose `sub` is our user id.
 */
@Injectable()
export class AuthService {
  private readonly key: Uint8Array;
  /** Compared against when the email is unknown, so both cases take the same time. */
  private readonly dummyHash: Promise<string>;

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Db,
    private readonly users: UsersService,
  ) {
    this.key = new TextEncoder().encode(env.JWT_SECRET);
    this.dummyHash = hash(randomUUID());
  }

  async signup(input: SignupInput): Promise<AuthSession> {
    const passwordHash = await hash(input.password);
    const [user] = await this.db
      .insert(users)
      .values({ authId: `local_${randomUUID()}`, name: input.name, email: input.email, passwordHash })
      .onConflictDoNothing({ target: users.email })
      .returning();
    if (!user) throw new ConflictException('An account with this email already exists. Log in instead.');
    return this.session(user);
  }

  async login(input: LoginInput): Promise<AuthSession> {
    const user = await this.db.query.users.findFirst({
      where: and(eq(users.email, input.email), isNull(users.deletedAt)),
    });
    const valid = await verify(user?.passwordHash ?? (await this.dummyHash), input.password);
    if (!user?.passwordHash || !valid) throw new UnauthorizedException(BAD_LOGIN);
    return this.session(user);
  }

  /**
   * Sign in with Apple. The token must be signed by Apple, for our app, and carry the hash of the
   * nonce this phone made (so a stolen token can't be replayed). The same Apple account always
   * maps to the same user; a verified email that already has an account signs into that account.
   */
  async signInWithApple(input: AppleSignInInput): Promise<AuthSession> {
    let sub: string;
    let email: string | null = null;
    try {
      const { payload } = await jwtVerify(input.identityToken, appleKeys, { issuer: APPLE_ISSUER, audience: this.env.APPLE_BUNDLE_ID });
      const nonce = createHash('sha256').update(input.nonce).digest('hex');
      if (typeof payload.sub !== 'string' || payload.nonce !== nonce) throw new Error('bad token');
      sub = payload.sub;
      const verified = payload.email_verified === true || payload.email_verified === 'true';
      if (typeof payload.email === 'string' && verified) email = payload.email.toLowerCase();
    } catch {
      throw new UnauthorizedException('Apple sign-in failed. Please try again.');
    }
    return this.session(await this.externalUser(`apple_${sub}`, email, input.name));
  }

  /**
   * Sign in with Google. The ID token must be signed by Google for one of our client IDs. Google
   * only vouches for the email when it says so (Gmail and Workspace addresses always are).
   */
  async signInWithGoogle(input: GoogleSignInInput): Promise<AuthSession> {
    const audience = this.env.GOOGLE_CLIENT_IDS;
    if (!audience.length) throw new ServiceUnavailableException('Google sign-in is not set up yet.');
    let sub: string;
    let email: string | null = null;
    let name: string | undefined;
    try {
      const { payload } = await jwtVerify(input.idToken, googleKeys, { issuer: GOOGLE_ISSUERS, audience });
      if (typeof payload.sub !== 'string') throw new Error('bad token');
      sub = payload.sub;
      const verified = payload.email_verified === true || payload.email_verified === 'true';
      if (typeof payload.email === 'string' && verified) email = payload.email.toLowerCase();
      if (typeof payload.name === 'string') name = payload.name;
    } catch {
      throw new UnauthorizedException('Google sign-in failed. Please try again.');
    }
    return this.session(await this.externalUser(`google_${sub}`, email, name));
  }

  /** Finds the user for a sign-in provider's account: by its id, then by verified email, else a new one. */
  private async externalUser(authId: string, email: string | null, name?: string) {
    const known = await this.db.query.users.findFirst({ where: and(eq(users.authId, authId), isNull(users.deletedAt)) });
    if (known) return known;
    if (email) {
      const byEmail = await this.db.query.users.findFirst({ where: and(eq(users.email, email), isNull(users.deletedAt)) });
      if (byEmail) return byEmail;
    }
    const fallback = email?.endsWith('@privaterelay.appleid.com') ? 'Guest' : (email?.split('@')[0] ?? 'Guest');
    return this.users.findOrCreate(authId, async () => ({ name: name?.trim() || fallback, email, avatarUrl: null }));
  }

  /** Returns the user id a token was issued to, or throws 401. */
  async verifyToken(token: string): Promise<string> {
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: ISSUER, audience: AUDIENCE, algorithms: ['HS256'] });
      if (!payload.sub) throw new Error('no subject');
      return payload.sub;
    } catch {
      throw new UnauthorizedException();
    }
  }

  private async session(user: typeof users.$inferSelect): Promise<AuthSession> {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(this.env.JWT_TTL)
      .sign(this.key);
    return { token, user: this.users.toDto(user) };
  }
}
