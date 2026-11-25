import { Body, Controller, Delete, Get, HttpCode, Patch, UseGuards } from '@nestjs/common';
import { updateProfileSchema, type UpdateProfileInput } from '@eventshare/shared';

import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { AccountService } from './account.service.js';
import { UsersService } from './users.service.js';

@UseGuards(AuthGuard)
@Controller('me')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly account: AccountService,
  ) {}

  @Get()
  me(@CurrentUser() user: AuthUser) {
    return this.users.toDto(user);
  }

  /** Edit profile: name, and an email to reach them at when the sign-in one is hidden. */
  @Patch()
  update(@CurrentUser() user: AuthUser, @Body(new ZodPipe(updateProfileSchema)) body: UpdateProfileInput) {
    return this.users.updateProfile(user.id, body);
  }

  /** Deletes the account, everything the person added and the events they host. */
  @Delete()
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser) {
    await this.account.delete(user.id);
  }
}
