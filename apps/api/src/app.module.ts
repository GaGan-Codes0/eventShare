import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthController } from './auth/auth.controller.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthService } from './auth/auth.service.js';
import { ConfigModule } from './config/config.module.js';
import { DbModule } from './db/db.module.js';
import { EventsController } from './events/events.controller.js';
import { EventsService } from './events/events.service.js';
import { HealthController } from './health.controller.js';
import { PhotosController } from './photos/photos.controller.js';
import { ArchiveService } from './photos/archive.service.js';
import { PhotosService } from './photos/photos.service.js';
import { StorageService } from './storage/storage.service.js';
import { UsersController } from './users/users.controller.js';
import { UsersService } from './users/users.service.js';

@Module({
  imports: [
    ConfigModule,
    DbModule,
    // Applied only where ThrottlerGuard is used (the auth routes): 10 attempts per minute per IP.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
  ],
  controllers: [HealthController, AuthController, UsersController, EventsController, PhotosController],
  providers: [AuthService, AuthGuard, UsersService, EventsService, PhotosService, ArchiveService, StorageService],
})
export class AppModule {}
