import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthSession, LoginInput, SignupInput } from '@eventshare/shared';
import { hash, verify } from '@node-rs/argon2';
import { and, eq, isNull } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';

import { ENV, type Env } from '../config/env.js';
import { DB, type Db } from '../db/db.module.js';
import { users } from '../db/schema.js';
import { UsersService } from '../users/users.service.js';

const ISSUER = 'eventshare-api';
const AUDIENCE = 'eventshare-app';
const BAD_LOGIN = 'Email or password is incorrect';

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
