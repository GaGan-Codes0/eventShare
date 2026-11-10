import { ARCHIVE_SCOPES, EVENT_TYPES, MEDIA_KINDS, NAME_JOINERS, PHOTO_FILTERS, REVEAL_MODES, type EventTheme, type FrameTemplate } from '@eventshare/shared';
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
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
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
    /** "Find my photos": guests can opt in with a selfie to see the photos they're in. Off by default. */
    findMyPhotos: boolean('find_my_photos').notNull().default(true),
    filter: photoFilter('filter').notNull().default('natural'),
    /** The host's shot list. */
    prompts: jsonb('prompts').$type<string[]>().notNull().default([]),
    /** The host's theme (validated by eventThemeSchema). Null is eventShare's own look. */
    theme: jsonb('theme').$type<EventTheme>(),
    /** Storage keys of the host's logo and poster (events/<id>/logo|poster/...). */
    logoKey: text('logo_key'),
    posterKey: text('poster_key'),
    /** The host's frame for saved photos: a PNG with a see-through middle. */
    frameKey: text('frame_key'),
    /** Or a ready-made frame (validated by frameTemplateSchema). Only one of the two is set. */
    frameTemplate: jsonb('frame_template').$type<FrameTemplate>(),
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
    /** Extra shots the hosts gave this guest on top of the event's allowance. */
    bonusShots: integer('bonus_shots').notNull().default(0),
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
    /** Photos: the mid-size image shown when one is opened. Older photos don't have it. */
    previewKey: text('preview_key'),
    /** Set while a big file is going up in pieces. */
    multipartUploadId: text('multipart_upload_id'),
    /** A photo, a video or a voice note: all live in the album together. */
    kind: mediaKind('kind').notNull().default('photo'),
    /** Videos and voice notes, as read from the file itself. */
    /** When the photo's faces were looked for (null: not yet). */
    facesScannedAt: timestamp('faces_scanned_at', { withTimezone: true }),
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

export const refillStatus = pgEnum('refill_status', ['pending', 'approved', 'declined']);

/** A guest out of shots asking the hosts for more. One open request per guest per event. */
export const shotRefillRequests = pgTable(
  'shot_refill_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    status: refillStatus('status').notNull().default('pending'),
    shots: integer('shots'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('refill_open_uidx').on(t.eventId, t.userId).where(sql`${t.status} = 'pending'`),
    index('refill_event_status_idx').on(t.eventId, t.status),
  ],
);

/**
 * Faces found in a photo, as faceprints (128 numbers from the SFace model), made on the phone
 * that uploaded it, or later by the host's phone for older photos. No picture of the face is kept.
 */
export const photoFaces = pgTable(
  'photo_faces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    photoId: uuid('photo_id')
      .notNull()
      .references(() => photos.id),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    /** Which model made it: only faceprints from the same model can be compared. */
    model: text('model').notNull(),
    embedding: vector('embedding', { dimensions: 128 }).notNull(),
    /** Where the face is, as fractions of the picture: [x, y, width, height]. */
    box: real('box').array().notNull(),
  },
  (t) => [index('photo_faces_event_idx').on(t.eventId, t.model), index('photo_faces_photo_idx').on(t.photoId)],
);

/**
 * A guest's opted-in selfie faceprint for one event (the selfie itself never leaves the phone).
 * Deleted when they switch it off, or when the host turns Find my photos off.
 */
export const faceProfiles = pgTable(
  'face_profiles',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    model: text('model').notNull(),
    embedding: vector('embedding', { dimensions: 128 }).notNull(),
    consentedAt: timestamp('consented_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId] })],
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
