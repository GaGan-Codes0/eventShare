import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';

import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { RefillsService } from './refills.service.js';

@UseGuards(AuthGuard)
@Controller('events/:id/refill-requests')
export class RefillsController {
  constructor(private readonly refills: RefillsService) {}

  @Post()
  @HttpCode(204)
  request(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.refills.request(id, user.id);
  }

  @Get()
  pending(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.refills.pending(id, user.id);
  }

  /** The amount is fixed (half the event's shots per guest); a `shots` sent by older app builds is ignored. */
  @Post(':requestId/approve')
  @HttpCode(204)
  approve(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.refills.decide(id, user.id, requestId, true);
  }

  @Post(':requestId/decline')
  @HttpCode(204)
  decline(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.refills.decide(id, user.id, requestId, false);
  }
}
