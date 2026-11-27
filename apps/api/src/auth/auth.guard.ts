import {
  createParamDecorator,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

import { ENV, type Env } from '../config/env.js';
import type { users } from '../db/schema.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

export type AuthUser = typeof users.$inferSelect;
type AuthedRequest = Request & { user?: AuthUser };

/**
 * Every non-auth route is authenticated: verifies our login token (Authorization: Bearer ...)
 * and loads the user it was issued to (AuthService.userFromToken).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(ENV) private readonly env: Env,
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
    req.user = await this.auth.userFromToken(token);
    return true;
  }
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
  if (!user) throw new UnauthorizedException();
  return user;
});
