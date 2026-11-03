// Clerk is switched off for now (own email + password login instead).
// import { createClerkClient, verifyToken, type ClerkClient } from '@clerk/backend';
import {
  createParamDecorator,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { and, eq, isNull } from 'drizzle-orm';

import { ENV, type Env } from '../config/env.js';
import { DB, type Db } from '../db/db.module.js';
import { users } from '../db/schema.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

export type AuthUser = typeof users.$inferSelect;
type AuthedRequest = Request & { user?: AuthUser };

/**
 * Every non-auth route is authenticated: verifies our login token (Authorization: Bearer ...)
 * and loads the user it was issued to.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Db,
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();

    const devUser = this.env.AUTH_DEV_BYPASS ? req.header('x-dev-user') : undefined;
    if (devUser) {
      const handle = devUser.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32);
      if (!handle) throw new UnauthorizedException();
      req.user = await this.users.findOrCreate(`dev_${handle}`, async () => ({
        name: handle.charAt(0).toUpperCase() + handle.slice(1),
        email: `${handle}@dev.local`,
        avatarUrl: null,
      }));
      return true;
    }

    const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException();
    const userId = await this.auth.verifyToken(token);
    const user = await this.db.query.users.findFirst({ where: and(eq(users.id, userId), isNull(users.deletedAt)) });
    if (!user) throw new UnauthorizedException();
    req.user = user;
    return true;

    // Clerk is switched off for now. To bring it back: verify the Clerk session token instead.
    // const { data, errors } = await verifyToken(token, { secretKey: this.env.CLERK_SECRET_KEY });
    // const sub = (data as { sub?: unknown } | undefined)?.sub;
    // if (errors || typeof sub !== 'string') throw new UnauthorizedException();
    // req.user = await this.users.findOrCreate(sub, async () => {
    //   const u = await createClerkClient({ secretKey: this.env.CLERK_SECRET_KEY }).users.getUser(sub);
    //   return {
    //     name: u.fullName || u.primaryEmailAddress?.emailAddress.split('@')[0] || 'Guest',
    //     email: u.primaryEmailAddress?.emailAddress ?? null,
    //     avatarUrl: u.hasImage ? u.imageUrl : null,
    //   };
    // });
  }
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
  if (!user) throw new UnauthorizedException();
  return user;
});
