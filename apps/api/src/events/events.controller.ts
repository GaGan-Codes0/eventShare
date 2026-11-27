import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import {
  changePlanSchema,
  createEventImageUploadSchema,
  createEventSchema,
  invitePhotographerSchema,
  joinEventSchema,
  updateEventSchema,
  removeMemberSchema,
  updateMemberSchema,
  type ChangePlanInput,
  type CreateEventImageUploadInput,
  type CreateEventData,
  type InvitePhotographerData,
  type JoinEventInput,
  type UpdateEventData,
  type RemoveMemberData,
  type UpdateMemberInput,
} from '@eventshare/shared';

import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { ENV, type Env } from '../config/env.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { EventsService } from './events.service.js';

/**
 * Codes are 6 digits, so without a limit one account could try them all and walk into strangers'
 * events. Counted per signed-in person (AuthGuard runs first), never per IP: a whole wedding shares
 * the venue's Wi-Fi. 30 tries in 10 minutes is far more than a guest mistyping ever needs.
 */
const JOIN_CODE_LIMIT = {
  account: { limit: 30, ttl: 10 * 60_000, getTracker: (req: Record<string, any>) => `join:${String(req.user?.id ?? req.ip)}` },
};

@UseGuards(AuthGuard)
@Controller()
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly realtime: RealtimeService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get('events')
  list(@CurrentUser() user: AuthUser) {
    return this.events.listMine(user.id);
  }

  @Post('events')
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createEventSchema)) body: CreateEventData) {
    return this.events.create(user.id, body);
  }

  /** The event's change counters. Phones use this if their live connection is down. */
  @Get('events/:id/live')
  async live(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.events.requireMember(id, user.id);
    return this.realtime.current(id);
  }

  @Get('events/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.events.detail(id, user.id);
  }

  /** Host: move the event to a bigger package, paid in the app (see EventsService.changePlan). */
  @Post('events/:id/plan')
  @HttpCode(200)
  changePlan(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(changePlanSchema)) body: ChangePlanInput,
  ) {
    return this.events.changePlan(id, user.id, body, this.env.PLAN_SELF_UPGRADE);
  }

  /** Host: Restore purchases. Applies a paid upgrade that never reached this event (see EventsService.restorePlan). */
  @Post('events/:id/plan/restore')
  @HttpCode(200)
  restorePlan(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.events.restorePlan(id, user.id);
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

  /** Host removes someone with a reason, optionally banning them and deleting what they added. */
  @Post('events/:id/members/:userId/remove')
  @HttpCode(204)
  removeMemberWithReason(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodPipe(removeMemberSchema)) body: RemoveMemberData,
  ) {
    return this.events.removeMember(id, user.id, userId, body);
  }

  /** Older app builds: removes and bans, with no reason. */
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
  @UseGuards(ThrottlerGuard)
  @Throttle(JOIN_CODE_LIMIT)
  preview(@Param('code') code: string) {
    const parsed = joinEventSchema.safeParse({ code });
    if (!parsed.success) throw new BadRequestException('Codes are 6 digits');
    return this.events.preview(parsed.data.code);
  }

  @Post('join')
  @UseGuards(ThrottlerGuard)
  @Throttle(JOIN_CODE_LIMIT)
  join(@CurrentUser() user: AuthUser, @Body(new ZodPipe(joinEventSchema)) body: JoinEventInput) {
    return this.events.join(user.id, body.code);
  }
}
