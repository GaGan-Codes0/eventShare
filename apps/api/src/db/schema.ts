import { ARCHIVE_SCOPES, EVENT_TYPES, MEDIA_KINDS, NAME_JOINERS, PHOTO_FILTERS, REVEAL_MODES, type EventTheme } from '@eventshare/shared';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
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
export const eventType = pgEnum('event_type', EVENT_TYPES);
export const revealMode = pgEnum('reveal_mode', REVEAL_MODES);
export const photoFilter = pgEnum('photo_filter', PHOTO_FILTERS);
export const mediaKind = pgEnum('media_kind', MEDIA_KINDS);
export const archiveScope = pgEnum('archive_scope', ARCHIVE_SCOPES);
export const archiveStatus = pgEnum('archive_status', ['building', 'ready', 'failed']);

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
    /** Display name: the title, or the couple's names for a wedding (kept in step by the service). */
    name: text('name').notNull(),
    type: eventType('type').notNull().default('other'),
    /** A wedding's couple, shown as "partner1 joiner partner2". */
    partner1: text('partner1'),
    partner2: text('partner2'),
    joiner: text('joiner').$type<(typeof NAME_JOINERS)[number]>().notNull().default('&'),
    /** "Hosted by", or the company for corporate events. */
    organizer: text('organizer'),
    /** The host's welcome line on the event's home. */
    tagline: text('tagline'),
    location: text('location'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    /** One code per event, shared as a link and a QR. Host can rotate it. */
    joinCode: text('join_code').notNull().unique(),
    coverPhotoId: uuid('cover_photo_id'),
    /** How many photos each guest may upload: 10, 24, 36 or 50; null is no limit. Older events may have 20/40/60. */
    guestPhotoLimit: integer('guest_photo_limit').default(36),
    revealMode: revealMode('reveal_mode').notNull().default('live'),
    /** Until then guests see only their own photos. Null: open now. */
    albumOpensAt: timestamp('album_opens_at', { withTimezone: true }),
    requireReview: boolean('require_review').notNull().default(false),
    allowDownloads: boolean('allow_downloads').notNull().default(true),
    allowLibraryUploads: boolean('allow_library_uploads').notNull().default(true),
    dateStamp: boolean('date_stamp').notNull().default(true),
    filter: photoFilter('filter').notNull().default('natural'),
    /** The host's shot list. */
    prompts: jsonb('prompts').$type<string[]>().notNull().default([]),
    /** The host's theme (validated by eventThemeSchema). Null is eventShare's own look. */
    theme: jsonb('theme').$type<EventTheme>(),
    /** Storage keys of the host's logo and poster (events/<id>/logo|poster/...). */
    logoKey: text('logo_key'),
    posterKey: text('poster_key'),
    ...timestamps,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('events_guest_photo_limit_check', sql`${t.guestPhotoLimit} IS NULL OR ${t.guestPhotoLimit} IN (10, 24, 36, 50, 20, 40, 60)`),
    check('events_joiner_check', sql`${t.joiner} IN ('&', 'and', '+')`),
  ],
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
    /** Video and voice time this person has used here, raised the same way (never past the limit). */
    videoMsUsed: integer('video_ms_used').notNull().default(0),
    voiceMsUsed: integer('voice_ms_used').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId] }), index('event_members_user_idx').on(t.userId)],
);

/**
 * The host's email invites to be a designated photographer. An open invite (neither accepted nor
 * cancelled) holds one of the event's photographer slots; joining with that email accepts it.
 */
export const photographerInvites = pgTable(
  'photographer_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    name: text('name').notNull(),
    /** Stored lowercased, like users.email. */
    email: text('email').notNull(),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    acceptedBy: uuid('accepted_by').references(() => users.id),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    /** When the invite email went out (null: not sent, e.g. no mail service set up). */
    emailedAt: timestamp('emailed_at', { withTimezone: true }),
  },
  (t) => [
    // One open invite per email per event.
    uniqueIndex('photographer_invites_open_uidx')
      .on(t.eventId, t.email)
      .where(sql`${t.acceptedAt} is null and ${t.cancelledAt} is null`),
  ],
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
    /** Photos and videos have a preview; voice notes don't. */
    thumbKey: text('thumb_key'),
    /** A photo, a video or a voice note: all live in the album together. */
    kind: mediaKind('kind').notNull().default('photo'),
    /** Videos and voice notes, as read from the file itself. */
    durationMs: integer('duration_ms'),
    contentType: text('content_type').notNull(),
    byteSize: bigint('byte_size', { mode: 'number' }).notNull(),
    width: integer('width'),
    height: integer('height'),
    takenAt: timestamp('taken_at', { withTimezone: true }),
    status: photoStatus('status').notNull().default('pending'),
    visibility: photoVisibility('visibility').notNull().default('visible'),
    /** A guest photo waiting for the host's OK (when the event requires review). */
    pendingReview: boolean('pending_review').notNull().default(false),
    /** The shot-list prompt it was taken for. */
    prompt: text('prompt'),
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

/** One like per person per photo. */
export const photoLikes = pgTable(
  'photo_likes',
  {
    photoId: uuid('photo_id')
      .notNull()
      .references(() => photos.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.photoId, t.userId] })],
);

/**
 * "Download all" ZIPs. One per event and choice is reused while its photos haven't changed
 * (same fingerprint); each is deleted after a few days.
 */
export const eventArchives = pgTable(
  'event_archives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    scope: archiveScope('scope').notNull(),
    status: archiveStatus('status').notNull().default('building'),
    /** Storage key of the ZIP (archives/<eventId>/<id>.zip). */
    key: text('key').notNull(),
    /** Which photos went in: their count, total size and newest upload. Any change means a new ZIP. */
    fingerprint: text('fingerprint').notNull(),
    photoCount: integer('photo_count').notNull(),
    byteSize: bigint('byte_size', { mode: 'number' }).notNull(),
    ...timestamps,
  },
  (t) => [index('event_archives_event_scope_idx').on(t.eventId, t.scope)],
);
