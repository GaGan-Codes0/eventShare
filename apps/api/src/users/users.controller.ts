import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Put, UseGuards } from '@nestjs/common';
import { updateProfileSchema, type UpdateProfileInput } from '@eventshare/shared';

import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { AccountService } from './account.service.js';
import { BlocksService } from './blocks.service.js';
import { UsersService } from './users.service.js';

@UseGuards(AuthGuard)
@Controller('me')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly account: AccountService,
    private readonly blocks: BlocksService,
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

  /** People you blocked, newest first. */
  @Get('blocks')
  blocked(@CurrentUser() user: AuthUser) {
    return this.blocks.list(user.id);
  }

  /** Block someone: you stop seeing anything they add, in every event. */
  @Put('blocks/:userId')
  @HttpCode(204)
  async block(@CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) blockedId: string) {
    await this.blocks.block(user.id, blockedId);
  }

  @Delete('blocks/:userId')
  @HttpCode(204)
  async unblock(@CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) blockedId: string) {
    await this.blocks.unblock(user.id, blockedId);
  }

  /** Deletes the account, everything the person added and the events they host. */
  @Delete()
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser) {
    await this.account.delete(user.id);
  }
}
