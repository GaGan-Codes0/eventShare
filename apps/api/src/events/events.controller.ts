import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import {
  createEventImageUploadSchema,
  createEventSchema,
  invitePhotographerSchema,
  joinEventSchema,
  updateEventSchema,
  updateMemberSchema,
  type CreateEventImageUploadInput,
  type CreateEventData,
  type InvitePhotographerData,
  type JoinEventInput,
  type UpdateEventData,
  type UpdateMemberInput,
} from '@eventshare/shared';

import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { EventsService } from './events.service.js';

@UseGuards(AuthGuard)
@Controller()
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get('events')
  list(@CurrentUser() user: AuthUser) {
    return this.events.listMine(user.id);
  }

  @Post('events')
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createEventSchema)) body: CreateEventData) {
    return this.events.create(user.id, body);
  }

  @Get('events/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.events.detail(id, user.id);
  }

  @Patch('events/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(updateEventSchema)) body: UpdateEventData,
  ) {
    return this.events.update(id, user.id, body);
  }

  @Post('events/:id/images')
  createImageUpload(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(createEventImageUploadSchema)) body: CreateEventImageUploadInput,
  ) {
    return this.events.createImageUpload(id, user.id, body);
  }

  @Get('events/:id/members')
  members(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.events.members(id, user.id);
  }

  @Patch('events/:id/members/:userId')
  setMemberRole(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodPipe(updateMemberSchema)) body: UpdateMemberInput,
  ) {
    return this.events.setMemberRole(id, user.id, userId, body);
  }

  @Get('events/:id/photographer-invites')
  photographerInvites(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.events.photographerInvites(id, user.id);
  }

  @Post('events/:id/photographer-invites')
  invitePhotographer(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(invitePhotographerSchema)) body: InvitePhotographerData,
  ) {
    return this.events.invitePhotographer(id, user.id, body);
  }

  @Delete('events/:id/photographer-invites/:inviteId')
  @HttpCode(204)
  cancelPhotographerInvite(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
  ) {
    return this.events.cancelPhotographerInvite(id, user.id, inviteId);
  }

  @Delete('events/:id/members/:userId')
  @HttpCode(204)
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.events.removeMember(id, user.id, userId);
  }

  @Post('events/:id/rotate-code')
  rotateCode(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.events.rotateCode(id, user.id);
  }

  @Get('join/:code')
  preview(@Param('code') code: string) {
    const parsed = joinEventSchema.safeParse({ code });
    if (!parsed.success) throw new BadRequestException('Codes are 8 characters');
    return this.events.preview(parsed.data.code);
  }

  @Post('join')
  join(@CurrentUser() user: AuthUser, @Body(new ZodPipe(joinEventSchema)) body: JoinEventInput) {
    return this.events.join(user.id, body.code);
  }
}
