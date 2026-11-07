import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { faceProfileSchema, saveFacesSchema, type FaceProfileInput, type SaveFacesInput } from '@eventshare/shared';

import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { FacesService } from './faces.service.js';

@UseGuards(AuthGuard)
@Controller()
export class FacesController {
  constructor(private readonly faces: FacesService) {}

  @Put('photos/:id/faces')
  saveFaces(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(saveFacesSchema)) body: SaveFacesInput) {
    return this.faces.saveFaces(id, user.id, body);
  }

  @Get('events/:id/faces/pending')
  pending(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.faces.pending(id, user.id);
  }

  @Put('events/:id/face-profile')
  @HttpCode(204)
  setProfile(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(faceProfileSchema)) body: FaceProfileInput) {
    return this.faces.setProfile(id, user.id, body);
  }

  @Delete('events/:id/face-profile')
  @HttpCode(204)
  deleteProfile(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.faces.deleteProfile(id, user.id);
  }
}
