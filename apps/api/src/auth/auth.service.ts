import { BadRequestException, ConflictException, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { AppleSignInInput, AuthSession, ForgotPasswordInput, GoogleSignInInput, LoginInput, ResetPasswordInput, SignupInput } from '@eventshare/shared';
import { hash, verify } from '@node-rs/argon2';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

import { ENV, type Env } from '../config/env.js';
import { DB, type Db } from '../db/db.module.js';
import { passwordResets, users } from '../db/schema.js';
import { MailService } from '../mail/mail.service.js';
import { isHiddenEmail, UNNAMED, UsersService } from '../users/users.service.js';

const ISSUER = 'eventshare-api';
const AUDIENCE = 'eventshare-app';
const BAD_LOGIN = 'Email or password is incorrect';
const PASSWORD_ACCOUNT = 'This email already has a Klickers password. Log in with your email and password.';
const BAD_RESET = 'That code isn’t right or has expired. Ask for a new one.';
/** Forgot password: how long a code works, how many tries it allows, and how often one is sent. */
const RESET_TTL_MS = 15 * 60_000;
const RESET_MAX_ATTEMPTS = 5;
const RESET_RESEND_MS = 60_000;
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
    private readonly mail: MailService,
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
      // A password account's email was only typed in, never proven. Signing Apple's or Google's
      // verified owner of that email into it would let whoever typed it keep a way in with their
      // password (account pre-hijacking), so that account is only ever opened with its password.
      if (byEmail?.passwordHash) throw new ConflictException(PASSWORD_ACCOUNT);
      if (byEmail) return byEmail;
    }
    // No name from the provider: the email's first part if it's a real address, else UNNAMED (the app then asks).
    const fallback = isHiddenEmail(email) ? UNNAMED : email!.split('@')[0];
    return this.users.findOrCreate(authId, async () => ({ name: name?.trim() || fallback, email, avatarUrl: null }));
  }

  /**
   * The signed-in user a login token belongs to, or 401: the token must be ours and unexpired, the
   * account not deleted, and the token issued after the last password reset (which signs out
   * every other phone). Used by every authenticated route and by the live-updates socket.
   */
  async userFromToken(token: string): Promise<typeof users.$inferSelect> {
    let userId: string;
    let issuedAt: number;
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: ISSUER, audience: AUDIENCE, algorithms: ['HS256'] });
      if (!payload.sub || typeof payload.iat !== 'number') throw new Error('incomplete token');
      userId = payload.sub;
      issuedAt = payload.iat * 1000;
    } catch {
      throw new UnauthorizedException();
    }
    const user = await this.db.query.users.findFirst({ where: and(eq(users.id, userId), isNull(users.deletedAt)) });
    if (!user || (user.sessionsValidAfter && issuedAt < user.sessionsValidAfter.getTime())) throw new UnauthorizedException();
    return user;
  }

  /**
   * Forgot password, step 1. Emails a 6-digit code to an account with a password (an Apple or
   * Google account is told how it signs in instead). Answers the same way whether or not the
   * email has an account, and sends at most one email a minute per account.
   */
  async requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
    const user = await this.db.query.users.findFirst({ where: and(eq(users.email, input.email), isNull(users.deletedAt)) });
    if (!user?.email) return;
    const [latest] = await this.db
      .select({ createdAt: passwordResets.createdAt })
      .from(passwordResets)
      .where(eq(passwordResets.userId, user.id))
      .orderBy(desc(passwordResets.createdAt))
      .limit(1);
    if (latest && Date.now() - latest.createdAt.getTime() < RESET_RESEND_MS) return;
    if (!user.passwordHash) {
      // Recorded too, so asking again doesn't send this email more than once a minute.
      await this.db.insert(passwordResets).values({ userId: user.id, codeHash: '-', expiresAt: new Date(), usedAt: new Date() });
      await this.mail.passwordReset({ to: user.email, name: user.name, code: null });
      return;
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.db.transaction(async (tx) => {
      // Only the newest code works.
      await tx
        .update(passwordResets)
        .set({ usedAt: new Date() })
        .where(and(eq(passwordResets.userId, user.id), isNull(passwordResets.usedAt)));
      await tx.insert(passwordResets).values({ userId: user.id, codeHash: this.resetHash(user.id, code), expiresAt: new Date(Date.now() + RESET_TTL_MS) });
    });
    await this.mail.passwordReset({ to: user.email, name: user.name, code });
  }

  /**
   * Forgot password, step 2: the emailed code and a new password. Sets the password, signs out
   * every phone that was signed in, and signs this one in.
   */
  async resetPassword(input: ResetPasswordInput): Promise<AuthSession> {
    const user = await this.db.query.users.findFirst({ where: and(eq(users.email, input.email), isNull(users.deletedAt)) });
    if (!user?.passwordHash) throw new BadRequestException(BAD_RESET);
    const [reset] = await this.db
      .select()
      .from(passwordResets)
      .where(and(eq(passwordResets.userId, user.id), isNull(passwordResets.usedAt)))
      .orderBy(desc(passwordResets.createdAt))
      .limit(1);
    if (!reset || reset.expiresAt.getTime() < Date.now() || reset.attempts >= RESET_MAX_ATTEMPTS) throw new BadRequestException(BAD_RESET);

    const expected = Buffer.from(reset.codeHash, 'hex');
    const given = Buffer.from(this.resetHash(user.id, input.code), 'hex');
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      await this.db
        .update(passwordResets)
        .set({ attempts: reset.attempts + 1 })
        .where(eq(passwordResets.id, reset.id));
      throw new BadRequestException(BAD_RESET);
    }

    const passwordHash = await hash(input.password);
    // Whole seconds, as tokens carry their issue time in seconds: the new token still counts.
    const now = new Date(Math.floor(Date.now() / 1000) * 1000);
    const [updated] = await this.db.transaction(async (tx) => {
      const [used] = await tx
        .update(passwordResets)
        .set({ usedAt: now })
        .where(and(eq(passwordResets.id, reset.id), isNull(passwordResets.usedAt)))
        .returning({ id: passwordResets.id });
      // Two requests racing with the same code: only one gets to use it.
      if (!used) throw new BadRequestException(BAD_RESET);
      return tx.update(users).set({ passwordHash, sessionsValidAfter: now }).where(eq(users.id, user.id)).returning();
    });
    return this.session(updated);
  }

  /** A code is kept only as a hash keyed with the server's secret and the account, never as is. */
  private resetHash(userId: string, code: string) {
    return createHmac('sha256', this.key).update(`${userId}:${code}`).digest('hex');
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
