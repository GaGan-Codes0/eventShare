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

export type EventRole = 'host' | 'member';

export const createEventSchema = z.object({
  name: z.string().trim().min(2, 'Give your event a name').max(80),
  location: z.string().trim().max(120).optional(),
  startsAt: z.iso.datetime().optional(),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

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
  coverUrl: string | null;
  role: EventRole;
  memberCount: number;
  photoCount: number;
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
};

export type Member = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: EventRole;
  joinedAt: string;
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

export type ApiError = { statusCode: number; message: string; code?: string };
