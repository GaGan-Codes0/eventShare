/**
 * API contract shared by apps/mobile and apps/api.
 * Request bodies are zod schemas (validated on the server, reused for forms in the app);
 * responses are plain types.
 */
import { z } from 'zod';

// ---------- limits ----------

/** Max size of a single original photo upload. Originals are never recompressed. */
export const MAX_PHOTO_BYTES = 50 * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/heic', 'image/heif', 'image/png', 'image/webp'] as const;
export const PHOTO_PAGE_SIZE = 60;
export const MAX_THUMB_BYTES = 2 * 1024 * 1024;
/** Long edge of the gallery preview the phone generates. */
export const THUMB_MAX_EDGE = 720;

// ---------- users ----------

export type User = {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
};

// ── Auth ──────────────────────────────────────────────────────────────────────

export const PASSWORD_MIN_LENGTH = 8;

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email'));

export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(80),
  email,
  password: z.string().min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`).max(128),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Returned by sign up and log in. Send `token` as `Authorization: Bearer <token>`. */
export type AuthSession = { token: string; user: User };

// ---------- events ----------

/** `member` is a guest. A photographer is a guest the host trusts with a much bigger allowance. */
export const EVENT_ROLES = ['host', 'photographer', 'member'] as const;
export type EventRole = (typeof EVENT_ROLES)[number];

/** What's being celebrated. Sets the starting theme, fonts and shot list. */
export const EVENT_TYPES = ['wedding', 'corporate', 'birthday', 'other'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** A wedding is named after the couple, joined by one of these: "Tanya & Paul". */
export const NAME_JOINERS = ['&', 'and', '+'] as const;
export type NameJoiner = (typeof NAME_JOINERS)[number];

/** Shots per guest the host can pick, or null for no limit. 36 (a roll of film) by default. */
export const GUEST_PHOTO_LIMITS = [10, 24, 36, 50] as const;
export type GuestPhotoLimit = (typeof GUEST_PHOTO_LIMITS)[number];
export const DEFAULT_GUEST_PHOTO_LIMIT: GuestPhotoLimit = 36;
export const PHOTOGRAPHER_PHOTO_LIMIT = 1000;
export const HOST_PHOTO_LIMIT = 500;
export const MAX_PHOTOGRAPHERS = 3;

/**
 * How many photos someone in this role may upload to one event; null means no limit.
 * Events made before the 10/24/36/50 choices may still have 20, 40 or 60 for guests.
 */
export function photoLimitFor(role: EventRole, guestPhotoLimit: number | null): number | null {
  if (role === 'host') return HOST_PHOTO_LIMIT;
  if (role === 'photographer') return PHOTOGRAPHER_PHOTO_LIMIT;
  return guestPhotoLimit;
}

const guestPhotoLimit = z.union([
  z.literal(GUEST_PHOTO_LIMITS, { error: `Choose ${GUEST_PHOTO_LIMITS.join(', ')} or no limit` }),
  z.null(),
]);

/** When guests see each other's photos. Until then everyone sees only their own; the host sees all. */
export const REVEAL_MODES = ['live', 'after', 'morning'] as const;
export type RevealMode = (typeof REVEAL_MODES)[number];

/** A look shown on every photo in the event. Originals are always stored untouched. */
export const PHOTO_FILTERS = ['natural', 'golden', 'mono', 'faded'] as const;
export type PhotoFilter = (typeof PHOTO_FILTERS)[number];

/** The host's shot list: prompts guests can shoot for, e.g. "The first look". */
export const MAX_PROMPTS = 12;
const prompt = z.string().trim().min(1).max(60);
const prompts = z.array(prompt).max(MAX_PROMPTS, `Up to ${MAX_PROMPTS} prompts`);

// ---------- event themes ----------

/** Ready-made looks the host can pick. `sage` is eventShare's own; midnight and graphite are dark. */
export const THEME_PRESETS = ['sage', 'blush', 'marigold', 'midnight', 'navy', 'graphite'] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];

/** Accent colours offered with every theme; the host can also type their own. */
export const THEME_ACCENTS = ['#385447', '#A3455A', '#C4521A', '#B8862F', '#1F4FD1', '#5B4A9E', '#0E7A70', '#2A2A2A'] as const;

/** Heading fonts. Body text is always DM Sans. */
export const FONT_PAIRINGS = ['classic', 'romantic', 'script', 'editorial', 'modern', 'bold'] as const;
export type FontPairing = (typeof FONT_PAIRINGS)[number];

/** What goes around the event poster. */
export const POSTER_FRAMES = ['none', 'line', 'double', 'polaroid'] as const;
export type PosterFrame = (typeof POSTER_FRAMES)[number];

/**
 * An event's look, chosen by the host: a preset, optionally with its own accent colour (buttons
 * and highlights), a heading font and a poster frame. The app builds the full palette.
 */
export const eventThemeSchema = z.object({
  preset: z.enum(THEME_PRESETS),
  accent: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Use a colour like #385447')
    .transform((c) => c.toUpperCase())
    .nullable(),
  fonts: z.enum(FONT_PAIRINGS),
  frame: z.enum(POSTER_FRAMES),
});
export type EventTheme = z.infer<typeof eventThemeSchema>;

/** The host's own pictures: a logo, and a poster that replaces the newest photo as the cover. */
export const EVENT_IMAGE_KINDS = ['logo', 'poster'] as const;
export type EventImageKind = (typeof EVENT_IMAGE_KINDS)[number];
export const EVENT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_EVENT_IMAGE_BYTES = 15 * 1024 * 1024;
/** The phone shrinks them before upload: long edge in pixels. */
export const EVENT_IMAGE_MAX_EDGE: Record<EventImageKind, number> = { logo: 512, poster: 1600 };

export const createEventImageUploadSchema = z.object({
  kind: z.enum(EVENT_IMAGE_KINDS),
  contentType: z.enum(EVENT_IMAGE_TYPES),
  byteSize: z.number().int().positive().max(MAX_EVENT_IMAGE_BYTES, 'Pick an image under 15 MB'),
});
export type CreateEventImageUploadInput = z.infer<typeof createEventImageUploadSchema>;

/** Upload to `upload`, then save `key` as the event's logoKey / posterKey. */
export type EventImageUpload = { key: string; upload: UploadTarget };

const imageKey = z.string().max(200).nullable();

const text = (max: number) => z.string().trim().max(max);
/** Blank means not set. */
const optionalText = (max: number) =>
  text(max)
    .nullable()
    .transform((s) => s || null);

export const createEventSchema = z
  .object({
    type: z.enum(EVENT_TYPES).default('other'),
    /** The event's title. For weddings it's made from the couple's names instead. */
    name: text(80).optional(),
    partner1: text(40).optional(),
    partner2: text(40).optional(),
    joiner: z.enum(NAME_JOINERS).default('&'),
    /** "Hosted by", or the company for corporate events. */
    organizer: optionalText(80).optional(),
    tagline: optionalText(200).optional(),
    location: text(120).optional(),
    startsAt: z.iso.datetime().optional(),
    guestPhotoLimit: guestPhotoLimit.optional(),
    revealMode: z.enum(REVEAL_MODES).optional(),
    /** When the album opens for guests; the phone works it out from the reveal mode in local time. */
    albumOpensAt: z.iso.datetime().nullable().optional(),
    theme: eventThemeSchema.nullable().optional(),
    prompts: prompts.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'wedding') {
      if (!v.partner1) ctx.addIssue({ code: 'custom', path: ['partner1'], message: 'Add both names' });
      if (!v.partner2) ctx.addIssue({ code: 'custom', path: ['partner2'], message: 'Add both names' });
    } else if (!v.name || v.name.length < 2) {
      ctx.addIssue({ code: 'custom', path: ['name'], message: 'Give your event a name' });
    }
  });
/** What the app sends. */
export type CreateEventInput = z.input<typeof createEventSchema>;
/** What the server works with after validation. */
export type CreateEventData = z.output<typeof createEventSchema>;

export const updateEventSchema = z
  .object({
    type: z.enum(EVENT_TYPES),
    name: text(80).min(2, 'Give your event a name'),
    partner1: text(40).min(1, 'Add both names'),
    partner2: text(40).min(1, 'Add both names'),
    joiner: z.enum(NAME_JOINERS),
    organizer: optionalText(80),
    tagline: optionalText(200),
    location: optionalText(120),
    startsAt: z.iso.datetime().nullable(),
    guestPhotoLimit,
    revealMode: z.enum(REVEAL_MODES),
    albumOpensAt: z.iso.datetime().nullable(),
    /** Guest photos wait for the host's OK before others see them. Photographers skip the queue. */
    requireReview: z.boolean(),
    /** Guests can save photos to their phone. The host always can, and everyone can save their own. */
    allowDownloads: z.boolean(),
    /** Guests can add photos from their camera roll (photographers always can). */
    allowLibraryUploads: z.boolean(),
    /** A small date stamp on photos, like a disposable camera. Display only. */
    dateStamp: z.boolean(),
    filter: z.enum(PHOTO_FILTERS),
    prompts,
    theme: eventThemeSchema.nullable(),
    logoKey: imageKey,
    posterKey: imageKey,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateEventInput = z.input<typeof updateEventSchema>;
export type UpdateEventData = z.output<typeof updateEventSchema>;

/** The host can make a guest a photographer (up to MAX_PHOTOGRAPHERS), and back. Nobody can be made host. */
export const updateMemberSchema = z.object({ role: z.enum(['photographer', 'member']) });
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

/** Join codes are 8 chars from an unambiguous alphabet (no 0/O, 1/I/L). */
export const JOIN_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const JOIN_CODE_LENGTH = 8;

export const joinEventSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .transform((s) => s.replace(/[\s-]/g, ''))
    .pipe(z.string().length(JOIN_CODE_LENGTH, 'Codes are 8 characters')),
});
export type JoinEventInput = z.infer<typeof joinEventSchema>;

/** Who and what an event is: shown on posters, the invite and the join preview. */
export type EventIdentity = {
  /** Display name: the title, or the couple's names for a wedding. */
  name: string;
  type: EventType;
  partner1: string | null;
  partner2: string | null;
  joiner: NameJoiner;
  organizer: string | null;
  tagline: string | null;
  location: string | null;
  startsAt: string | null;
  theme: EventTheme | null;
  posterUrl: string | null;
  logoUrl: string | null;
};

/** The host's rules for the event. */
export type EventRules = {
  /** Every guest's allowance; null is no limit. Photographers and the host get more. */
  guestPhotoLimit: number | null;
  revealMode: RevealMode;
  albumOpensAt: string | null;
  /** False while guests can only see their own photos. Always true for the host. */
  albumOpen: boolean;
  requireReview: boolean;
  allowDownloads: boolean;
  allowLibraryUploads: boolean;
  dateStamp: boolean;
  filter: PhotoFilter;
  prompts: string[];
};

export type EventSummary = EventIdentity &
  EventRules & {
    id: string;
    /** The host's poster if there is one, else the newest photo you can see. */
    coverUrl: string | null;
    role: EventRole;
    memberCount: number;
    photographerCount: number;
    photoCount: number;
    /** Guest photos waiting for the host's OK. Only counted for the host (0 for others). */
    pendingReviewCount: number;
    /** Your own allowance (null: no limit) and how much of it you've used. Discarded shots never count. */
    photoLimit: number | null;
    photosUsed: number;
  };

export type EventDetail = EventSummary & {
  /** Present for every member: anyone in the event can invite others. */
  joinCode: string;
  ownerId: string;
  createdAt: string;
};

/** What a person sees before joining (from a link / QR). */
export type EventPreview = EventIdentity & {
  hostName: string;
  memberCount: number;
  guestPhotoLimit: number | null;
  /** First names of the designated photographers. */
  photographers: string[];
  revealMode: RevealMode;
  albumOpensAt: string | null;
  requireReview: boolean;
};

export type Member = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: EventRole;
  joinedAt: string;
  photosUsed: number;
};

// ---------- photos ----------

export type PhotoStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type PhotoVisibility = 'visible' | 'hidden';

export const createUploadSchema = z.object({
  /** Generated on the phone when the photo is taken; makes retries idempotent. */
  clientUploadId: z.uuid(),
  contentType: z.enum(ALLOWED_PHOTO_TYPES),
  byteSize: z.number().int().positive().max(MAX_PHOTO_BYTES),
  /** Small JPEG preview made on the phone; the original is never touched. */
  thumbByteSize: z.number().int().positive().max(MAX_THUMB_BYTES),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  takenAt: z.iso.datetime().optional(),
  /** Camera-roll uploads can be turned off by the host (photographers are never blocked). */
  source: z.enum(['camera', 'library']).default('camera'),
  /** The shot-list prompt this photo answers, if any. */
  prompt: z.string().trim().min(1).max(60).optional(),
});
export type CreateUploadInput = z.input<typeof createUploadSchema>;

export type UploadTarget = { url: string; headers: Record<string, string> };

export type UploadTicket = {
  photoId: string;
  status: PhotoStatus;
  /** Both null when this clientUploadId was already completed — nothing left to send. */
  original: UploadTarget | null;
  thumb: UploadTarget | null;
};

/** Host only: hide/unhide, or approve a guest photo waiting for review (declining deletes it). */
export const updatePhotoSchema = z
  .object({
    visibility: z.enum(['visible', 'hidden']),
    approved: z.literal(true),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdatePhotoInput = z.infer<typeof updatePhotoSchema>;

/** Album filters. `review` and `hidden` are for the host. */
export const PHOTO_LIST_FILTERS = ['all', 'photographers', 'guests', 'mine', 'review', 'hidden'] as const;
export type PhotoListFilter = (typeof PHOTO_LIST_FILTERS)[number];

export type PhotoLikes = { likeCount: number; likedByMe: boolean };

/** Host's "Download all": originals in a ZIP, in folders by who took them. */
export const ARCHIVE_SCOPES = ['all', 'photographers', 'guests'] as const;
export type ArchiveScope = (typeof ARCHIVE_SCOPES)[number];
export type ArchiveSummary = Record<ArchiveScope, { count: number; bytes: number }>;
export const createArchiveSchema = z.object({ scope: z.enum(ARCHIVE_SCOPES) });
export type CreateArchiveInput = z.infer<typeof createArchiveSchema>;
/**
 * Where a ZIP stands. Building happens on the server in the background, so the phone can close
 * the sheet and come back; a ready ZIP comes with a short-lived link and is kept for a few days.
 */
export type ArchiveStatus =
  | { status: 'building'; count: number; bytes: number }
  | { status: 'ready'; url: string; count: number; bytes: number }
  | { status: 'failed'; count: number; bytes: number };
/** How long a finished ZIP is kept and reused before it's deleted. */
export const ARCHIVE_KEEP_DAYS = 3;

export type Photo = {
  id: string;
  eventId: string;
  /** Their role in the event now (a photographer's photos carry a badge). */
  uploader: { id: string; name: string; role: EventRole };
  status: PhotoStatus;
  visibility: PhotoVisibility;
  /** A guest photo the host hasn't approved yet: only the host and its uploader see it. */
  pendingReview: boolean;
  prompt: string | null;
  likeCount: number;
  likedByMe: boolean;
  width: number | null;
  height: number | null;
  takenAt: string | null;
  createdAt: string;
  /** Short-lived signed URLs. */
  thumbUrl: string | null;
  url: string | null;
};

export type Page<T> = { items: T[]; nextCursor: string | null };

// ---------- errors ----------

export type ApiError = { statusCode: number; message: string; code?: ApiErrorCode };

/** Machine-readable reasons the app reacts to (instead of matching on message text). */
export type ApiErrorCode =
  | 'PHOTO_LIMIT_REACHED'
  | 'PHOTOGRAPHER_SLOTS_FULL'
  | 'LIBRARY_UPLOADS_OFF'
  | 'DOWNLOADS_OFF';
