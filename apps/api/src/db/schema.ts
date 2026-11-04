import type { EventTheme, GuestPhotoLimit } from '@eventshare/shared';
import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
};

export const memberRole = pgEnum('member_role', ['host', 'photographer', 'member']);
export const memberStatus = pgEnum('member_status', ['active', 'removed']);
export const photoStatus = pgEnum('photo_status', ['pending', 'processing', 'ready', 'failed']);
export const photoVisibility = pgEnum('photo_visibility', ['visible', 'hidden']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  /**
   * Who signs this user in: `local_<uuid>` for our own email + password accounts (Clerk's
   * `user_...` ids if Clerk comes back). Our own `id` is what every other table references.
   */
  authId: text('auth_id').notNull().unique(),
  name: text('name').notNull(),
  /** Stored lowercased; one account per email. */
  email: text('email').unique(),
  /** argon2id hash. Null for accounts that sign in elsewhere (dev users). */
  passwordHash: text('password_hash'),
  avatarUrl: text('avatar_url'),
  ...timestamps,
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    location: text('location'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    /** One code per event, shared as a link and a QR. Host can rotate it. */
    joinCode: text('join_code').notNull().unique(),
    coverPhotoId: uuid('cover_photo_id'),
    /** How many photos each guest may upload. The host picks 20, 40 or 60. */
    guestPhotoLimit: integer('guest_photo_limit').$type<GuestPhotoLimit>().notNull().default(20),
    /** The host's theme (validated by eventThemeSchema). Null is eventShare's own look. */
    theme: jsonb('theme').$type<EventTheme>(),
    ...timestamps,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [check('events_guest_photo_limit_check', sql`${t.guestPhotoLimit} IN (20, 40, 60)`)],
);

export const eventMembers = pgTable(
  'event_members',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: memberRole('role').notNull().default('member'),
    status: memberStatus('status').notNull().default('active'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    /**
     * Photos this person has started uploading here. Raised atomically, only while under their
     * limit, so concurrent uploads can't overshoot. Deleting a photo doesn't give the slot back.
     */
    photosUsed: integer('photos_used').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId] }), index('event_members_user_idx').on(t.userId)],
);

export const photos = pgTable(
  'photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    uploaderId: uuid('uploader_id')
      .notNull()
      .references(() => users.id),
    clientUploadId: uuid('client_upload_id').notNull(),
    storageKey: text('storage_key').notNull(),
    thumbKey: text('thumb_key').notNull(),
    contentType: text('content_type').notNull(),
    byteSize: bigint('byte_size', { mode: 'number' }).notNull(),
    width: integer('width'),
    height: integer('height'),
    takenAt: timestamp('taken_at', { withTimezone: true }),
    status: photoStatus('status').notNull().default('pending'),
    visibility: photoVisibility('visibility').notNull().default('visible'),
    ...timestamps,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    // Idempotent uploads: a retried upload from the same phone maps to the same row.
    uniqueIndex('photos_uploader_client_upload_uidx').on(t.uploaderId, t.clientUploadId),
    // Gallery pagination (newest first), skipping deleted rows.
    index('photos_event_gallery_idx')
      .on(t.eventId, t.createdAt.desc(), t.id.desc())
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);
