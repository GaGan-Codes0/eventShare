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

/** `member` is a guest. A photographer is a guest the host trusts with a bigger photo allowance. */
export const EVENT_ROLES = ['host', 'photographer', 'member'] as const;
export type EventRole = (typeof EVENT_ROLES)[number];

/** The host picks one of these for every guest in the event. */
export const GUEST_PHOTO_LIMITS = [20, 40, 60] as const;
export type GuestPhotoLimit = (typeof GUEST_PHOTO_LIMITS)[number];
export const DEFAULT_GUEST_PHOTO_LIMIT: GuestPhotoLimit = 20;
export const PHOTOGRAPHER_PHOTO_LIMIT = 500;
export const HOST_PHOTO_LIMIT = 500;

/** How many photos someone in this role may upload to one event. */
export function photoLimitFor(role: EventRole, guestPhotoLimit: number): number {
  if (role === 'host') return HOST_PHOTO_LIMIT;
  if (role === 'photographer') return PHOTOGRAPHER_PHOTO_LIMIT;
  return guestPhotoLimit;
}

const guestPhotoLimit = z.literal(GUEST_PHOTO_LIMITS, {
  error: `Choose ${GUEST_PHOTO_LIMITS.join(', ')} photos`,
});

// ---------- event themes ----------

/** Ready-made looks the host can pick. `evergreen` is eventShare's own. */
export const THEME_PRESETS = ['evergreen', 'rose', 'marigold', 'ocean', 'plum', 'terracotta', 'charcoal'] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];

/** Heading + body font pairs. */
export const FONT_PAIRINGS = ['classic', 'modern', 'elegant', 'romantic'] as const;
export type FontPairing = (typeof FONT_PAIRINGS)[number];

/** What goes around the event poster. */
export const POSTER_FRAMES = ['none', 'line', 'double', 'polaroid'] as const;
export type PosterFrame = (typeof POSTER_FRAMES)[number];

/**
 * An event's look, chosen by the host. Start from a preset; `color` (the host's own brand
 * colour) replaces the preset's colours when set. The app builds the full palette from it.
 */
export const eventThemeSchema = z.object({
  preset: z.enum(THEME_PRESETS),
  color: z
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

export const createEventSchema = z.object({
  name: z.string().trim().min(2, 'Give your event a name').max(80),
  location: z.string().trim().max(120).optional(),
  startsAt: z.iso.datetime().optional(),
  guestPhotoLimit: guestPhotoLimit.optional(),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = z
  .object({ guestPhotoLimit, theme: eventThemeSchema.nullable(), logoKey: imageKey, posterKey: imageKey })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

/** The host can make a guest the photographer, and back. Nobody can be made host. */
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

export type EventSummary = {
  id: string;
  name: string;
  location: string | null;
  startsAt: string | null;
  /** The host's poster if there is one, else the newest photo. */
  coverUrl: string | null;
  posterUrl: string | null;
  logoUrl: string | null;
  role: EventRole;
  memberCount: number;
  photoCount: number;
  /** Every guest's allowance in this event (photographers and the host get more). */
  guestPhotoLimit: GuestPhotoLimit;
  /** Your own allowance and how much of it you've used. Discarded shots never count. */
  photoLimit: number;
  photosUsed: number;
  /** The host's theme, or null for eventShare's own look. */
  theme: EventTheme | null;
};

export type EventDetail = EventSummary & {
  /** Present for every member: anyone in the event can invite others. */
  joinCode: string;
  ownerId: string;
  createdAt: string;
};

/** What a person sees before joining (from a link / QR). */
export type EventPreview = {
  name: string;
  location: string | null;
  startsAt: string | null;
  hostName: string;
  memberCount: number;
  theme: EventTheme | null;
  posterUrl: string | null;
  logoUrl: string | null;
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
});
export type CreateUploadInput = z.infer<typeof createUploadSchema>;

export type UploadTarget = { url: string; headers: Record<string, string> };

export type UploadTicket = {
  photoId: string;
  status: PhotoStatus;
  /** Both null when this clientUploadId was already completed — nothing left to send. */
  original: UploadTarget | null;
  thumb: UploadTarget | null;
};

export const updatePhotoSchema = z.object({
  visibility: z.enum(['visible', 'hidden']),
});
export type UpdatePhotoInput = z.infer<typeof updatePhotoSchema>;

export type Photo = {
  id: string;
  eventId: string;
  uploader: { id: string; name: string };
  status: PhotoStatus;
  visibility: PhotoVisibility;
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
export type ApiErrorCode = 'PHOTO_LIMIT_REACHED';
