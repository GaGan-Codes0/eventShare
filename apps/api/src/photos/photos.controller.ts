import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createUploadSchema,
  updatePhotoSchema,
  type CreateUploadInput,
  type UpdatePhotoInput,
} from '@eventshare/shared';

import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { PhotosService } from './photos.service.js';

@UseGuards(AuthGuard)
@Controller()
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Get('events/:id/photos')
  list(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query('cursor') cursor?: string) {
    return this.photos.list(id, user.id, cursor);
  }

  @Post('events/:id/photos/uploads')
  createUpload(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(createUploadSchema)) body: CreateUploadInput,
  ) {
    return this.photos.createUpload(id, user.id, body);
  }

  @Post('photos/:id/complete')
  complete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.photos.complete(id, user.id);
  }

  @Get('photos/:id/download')
  download(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.photos.downloadUrl(id, user.id);
  }

  @Patch('photos/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(updatePhotoSchema)) body: UpdatePhotoInput,
  ) {
    return this.photos.setVisibility(id, user.id, body.visibility);
  }

  @Delete('photos/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.photos.remove(id, user.id);
  }
}
