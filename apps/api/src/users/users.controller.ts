import { Controller, Delete, Get, HttpCode, UseGuards } from '@nestjs/common';

import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
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

  /** Deletes the account, everything the person added and the events they host. */
  @Delete()
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser) {
    await this.account.delete(user.id);
  }
}
