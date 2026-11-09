import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthController } from './auth/auth.controller.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthService } from './auth/auth.service.js';
import { ConfigModule } from './config/config.module.js';
import { DbModule } from './db/db.module.js';
import { EventsController } from './events/events.controller.js';
import { EventsService } from './events/events.service.js';
import { RefillsController } from './events/refills.controller.js';
import { RefillsService } from './events/refills.service.js';
import { FacesController } from './faces/faces.controller.js';
import { FacesService } from './faces/faces.service.js';
import { HealthController } from './health.controller.js';
import { MailService } from './mail/mail.service.js';
import { PhotosController } from './photos/photos.controller.js';
import { ArchiveService } from './photos/archive.service.js';
import { PhotosService } from './photos/photos.service.js';
import { RealtimeGateway } from './realtime/realtime.gateway.js';
import { RealtimeService } from './realtime/realtime.service.js';
import { QueueService } from './redis/queue.service.js';
import { RedisService } from './redis/redis.service.js';
import { StorageService } from './storage/storage.service.js';
import { UsersController } from './users/users.controller.js';
import { UsersService } from './users/users.service.js';

/** The account being tried; falls back to the IP for a request without an email. */
function accountTracker(req: Record<string, any>): string {
  const email: unknown = req.body?.email;
  return typeof email === 'string' && email ? email.trim().toLowerCase().slice(0, 320) : String(req.ip);
}

@Module({
  imports: [
    ConfigModule,
    DbModule,
    // Applied only where ThrottlerGuard is used (the auth routes). Password guessing is limited
    // per account. The per-IP limit is deliberately high: a whole wedding shares the venue's Wi-Fi
    // (and often one mobile-carrier address), so a tight one would lock guests out at the door.
    ThrottlerModule.forRoot([
      { name: 'account', ttl: 60_000, limit: 10, getTracker: accountTracker },
      { name: 'ip', ttl: 60_000, limit: 600 },
    ]),
  ],
  controllers: [HealthController, AuthController, UsersController, EventsController, PhotosController, FacesController, RefillsController],
  providers: [
    AuthService,
    AuthGuard,
    UsersService,
    EventsService,
    RefillsService,
    PhotosService,
    ArchiveService,
    StorageService,
    MailService,
    FacesService,
    RedisService,
    QueueService,
    RealtimeService,
    RealtimeGateway,
  ],
})
export class AppModule {}
