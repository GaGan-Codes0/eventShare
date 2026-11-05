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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createArchiveSchema,
  createUploadSchema,
  PHOTO_LIST_FILTERS,
  updatePhotoSchema,
  type CreateArchiveInput,
  type PhotoListFilter,
  type UpdatePhotoInput,
} from '@eventshare/shared';
import { z } from 'zod';

import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ArchiveService } from './archive.service.js';
import { PhotosService } from './photos.service.js';

@UseGuards(AuthGuard)
@Controller()
export class PhotosController {
  constructor(
    private readonly photos: PhotosService,
    private readonly archives: ArchiveService,
  ) {}

  /** Host: what "Download all" would hold, per choice. */
  @Get('events/:id/archive')
  archiveSummary(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.archives.summary(id, user.id);
  }

  /** Host: the ZIP of originals — reused if unchanged, else built in the background. Ask again until ready. */
  @Post('events/:id/archive')
  createArchive(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(createArchiveSchema)) body: CreateArchiveInput,
  ) {
    return this.archives.request(id, user.id, body.scope);
  }

  @Get('events/:id/photos')
  list(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('cursor') cursor?: string,
    @Query('filter', new ZodPipe(z.enum(PHOTO_LIST_FILTERS).optional())) filter?: PhotoListFilter,
  ) {
    return this.photos.list(id, user.id, cursor, filter);
  }

  @Post('events/:id/photos/uploads')
  createUpload(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(createUploadSchema)) body: z.output<typeof createUploadSchema>,
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
    return this.photos.update(id, user.id, body);
  }

  @Put('photos/:id/like')
  like(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.photos.setLiked(id, user.id, true);
  }

  @Delete('photos/:id/like')
  unlike(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.photos.setLiked(id, user.id, false);
  }

  @Delete('photos/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.photos.remove(id, user.id);
  }
}
