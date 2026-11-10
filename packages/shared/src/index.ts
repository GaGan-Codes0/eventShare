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

/** What a guest can add: photos, videos and voice notes. Videos and voice keep their own time limits. */
export const MEDIA_KINDS = ['photo', 'video', 'voice'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime'] as const;
export const ALLOWED_AUDIO_TYPES = ['audio/mp4', 'audio/x-m4a', 'audio/aac'] as const;
/** Videos are kept exactly as recorded (no quality cap); a single upload can be up to 5 GB. */
export const MAX_VIDEO_BYTES = 5 * 1024 * 1024 * 1024;
export const MAX_VOICE_BYTES = 50 * 1024 * 1024;
/** Video time per person per event, in total. Photographers get the same for now. */
export const VIDEO_LIMIT_MS = 5 * 60_000;
/** Voice-note time per person per event, in total. */
export const VOICE_LIMIT_MS = 60_000;
export const PHOTO_PAGE_SIZE = 60;
export const MAX_THUMB_BYTES = 2 * 1024 * 1024;
/** Long edge of the gallery preview the phone generates. */
export const THUMB_MAX_EDGE = 720;
/** The image shown when a photo is opened: sharp on any phone, a fraction of the original's size. */
export const PREVIEW_MAX_EDGE = 1600;
export const MAX_PREVIEW_BYTES = 5 * 1024 * 1024;
/** Files this big go up in pieces, so a dropped connection only costs the current piece. */
export const MULTIPART_THRESHOLD_BYTES = 20 * 1024 * 1024;
export const MULTIPART_PART_BYTES = 10 * 1024 * 1024;

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
/** The host's own shots per event: the same as a designated photographer. */
export const HOST_PHOTO_LIMIT = 1000;
export const MAX_PHOTOGRAPHERS = 3;

/**
 * How many photos someone in this role may upload to one event; null means no limit.
 * Events made before the 10/24/36/50 choices may still have 20, 40 or 60 for guests.
 */
export function photoLimitFor(role: EventRole, guestPhotoLimit: number | null, bonusShots = 0): number | null {
  // The host's pass: 1,000 shots and no review.
  if (role === 'host') return HOST_PHOTO_LIMIT;
  if (role === 'photographer') return PHOTOGRAPHER_PHOTO_LIMIT;
  return guestPhotoLimit === null ? null : guestPhotoLimit + bonusShots;
}

const HOUR_MS = 60 * 60_000;
/** How long the camera stays open after the event day ends. */
export const SHOOTING_HOURS_AFTER_EVENT_DAY = 48;
/** A shot taken in time but stuck on a phone with no signal can still arrive this long after closing. */
export const LATE_UPLOAD_GRACE_MS = 24 * HOUR_MS;

/**
 * When shooting is possible: all of the event day and the 48 hours after it. An event's date is
 * stored as midday on that day in the host's own time zone, so midnight is 12 hours either side.
 * An event with no date has no window.
 */
export function shootingWindow(startsAt: string | Date | null): { opensAt: number; closesAt: number } | null {
  if (!startsAt) return null;
  const midday = new Date(startsAt).getTime();
  return { opensAt: midday - 12 * HOUR_MS, closesAt: midday + (12 + SHOOTING_HOURS_AFTER_EVENT_DAY) * HOUR_MS };
}

export type ShootingPhase = 'early' | 'open' | 'closed';

/** Guests wait for the event day; hosts and photographers can shoot before it. Nobody can after. */
export function shootingPhase(role: EventRole, startsAt: string | Date | null, now = Date.now()): ShootingPhase {
  const window = shootingWindow(startsAt);
  if (!window) return 'open';
  if (now >= window.closesAt) return 'closed';
  return role === 'member' && now < window.opensAt ? 'early' : 'open';
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

/**
 * The host's own pictures: a logo, a poster that replaces the newest photo as the cover, and a
 * frame: a PNG with a see-through middle that guests can put around a photo when they save it.
 */
export const EVENT_IMAGE_KINDS = ['logo', 'poster', 'frame'] as const;
export type EventImageKind = (typeof EVENT_IMAGE_KINDS)[number];
export const EVENT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_EVENT_IMAGE_BYTES = 15 * 1024 * 1024;
/** The phone shrinks them before upload: long edge in pixels. */
export const EVENT_IMAGE_MAX_EDGE: Record<EventImageKind, number> = { logo: 512, poster: 1600, frame: 2400 };

export const createEventImageUploadSchema = z.object({
  kind: z.enum(EVENT_IMAGE_KINDS),
  contentType: z.enum(EVENT_IMAGE_TYPES),
  byteSize: z.number().int().positive().max(MAX_EVENT_IMAGE_BYTES, 'Pick an image under 15 MB'),
});
export type CreateEventImageUploadInput = z.infer<typeof createEventImageUploadSchema>;

/** Upload to `upload`, then save `key` as the event's logoKey / posterKey / frameKey. */
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
    /** Guests can opt in with a selfie to find the photos they're in. */
    findMyPhotos: z.boolean(),
    filter: z.enum(PHOTO_FILTERS),
    prompts,
    theme: eventThemeSchema.nullable(),
    logoKey: imageKey,
    posterKey: imageKey,
    frameKey: imageKey,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateEventInput = z.input<typeof updateEventSchema>;
export type UpdateEventData = z.output<typeof updateEventSchema>;

/** The host can make a guest a photographer (up to MAX_PHOTOGRAPHERS), and back. Nobody can be made host. */
export const updateMemberSchema = z.object({ role: z.enum(['photographer', 'member']) });
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

/**
 * Host invites someone by email to be a designated photographer. The invite takes a slot at
 * once; when that email joins the event, they become the photographer.
 */
export const invitePhotographerSchema = z.object({
  name: text(80).min(1, 'Add their name'),
  email: z.string().trim().toLowerCase().pipe(z.email('Add a valid email')),
});
export type InvitePhotographerInput = z.input<typeof invitePhotographerSchema>;
export type InvitePhotographerData = z.output<typeof invitePhotographerSchema>;

/** An invite that hasn't been taken up yet ("Invite sent"). */
export type PhotographerInvite = {
  id: string;
  name: string;
  email: string;
  invitedAt: string;
  /** The invite email went out ("Invite sent"); false when it couldn't (the host shares the code instead). */
  emailed: boolean;
};

/** What inviting did: an open invite, or (when that email is already in the event) straight to photographer. */
export type InvitePhotographerResult = { status: 'invited'; invite: PhotographerInvite } | { status: 'joined'; member: Member };

/** Join codes are 8 chars from an unambiguous alphabet (no 0/O, 1/I/L). */
export const JOIN_CODE_ALPHABET = '0123456789';
export const JOIN_CODE_LENGTH = 6;

export const joinEventSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((s) => s.replace(/[\s-]/g, ''))
    .pipe(z.string().regex(/^\d{6}$/, 'Codes are 6 digits')),
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
  /** The host's own frame (PNG with a see-through middle), offered when saving a photo. */
  frameUrl: string | null;
};

/** An event's change counters: a phone compares them to know when to refresh. */
export type EventLive = {
  /** Moves when new photos go live. */
  new: number;
  /** Moves on anything else: a hide, delete, approval or rule change. */
  rev: number;
  /** Moves when a guest asks for more shots, or the hosts answer. */
  refill: number;
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
  /** "Find my photos" is on for this event. */
  findMyPhotos: boolean;
  /** You've opted in with a selfie (always false while findMyPhotos is off). */
  hasFaceProfile: boolean;
  filter: PhotoFilter;
  prompts: string[];
};

/** How many extra shots the hosts can give a guest who asks. */
export const REFILL_SHOTS = [5, 10, 24] as const;
export const REFILL_RETRY_AFTER_MS = 10 * 60_000;
export const approveRefillSchema = z.object({ shots: z.union([z.literal(5), z.literal(10), z.literal(24)]) });
export type ApproveRefillInput = z.infer<typeof approveRefillSchema>;

/** Host: a guest who has asked for more shots. */
export type RefillRequest = {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  photosUsed: number;
  photoLimit: number | null;
  requestedAt: string;
};

export type EventSummary = EventIdentity &
  EventRules & {
    id: string;
    /** Guests: where your request for more shots stands (null: you can ask). */
    refillStatus: 'pending' | 'declined' | null;
    /** Host: guests waiting for more shots (0 for others). */
    pendingRefillCount: number;
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
    /** Video and voice time: your limits and what you've used, in milliseconds. */
    videoLimitMs: number;
    videoMsUsed: number;
    voiceLimitMs: number;
    voiceMsUsed: number;
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
  /** Extra shots the hosts have given this guest. */
  bonusShots: number;
  /** Only the host sees members' emails. */
  email?: string | null;
};

// ---------- photos ----------

export type PhotoStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type PhotoVisibility = 'visible' | 'hidden';

export const createUploadSchema = z
  .object({
    /** Generated on the phone when the photo is taken; makes retries idempotent. */
    clientUploadId: z.uuid(),
    kind: z.enum(MEDIA_KINDS).default('photo'),
    contentType: z.enum([...ALLOWED_PHOTO_TYPES, ...ALLOWED_VIDEO_TYPES, ...ALLOWED_AUDIO_TYPES]),
    byteSize: z.number().int().positive().max(MAX_VIDEO_BYTES),
    /** Small JPEG preview made on the phone (a video's first frame); voice notes have none. */
    thumbByteSize: z.number().int().positive().max(MAX_THUMB_BYTES).optional(),
    /** Photos: a mid-size JPEG made on the phone, shown when the photo is opened. */
    previewByteSize: z.number().int().positive().max(MAX_PREVIEW_BYTES).optional(),
    /** This app can send big files in pieces (older builds can't). */
    multipart: z.boolean().optional(),
    /** Videos and voice notes: their length as the phone measured it (the server checks the file). */
    durationMs: z.number().int().positive().max(VIDEO_LIMIT_MS).optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    takenAt: z.iso.datetime().optional(),
    /** Camera-roll uploads can be turned off by the host (photographers are never blocked). */
    source: z.enum(['camera', 'library']).default('camera'),
    /** The shot-list prompt this photo answers, if any. */
    prompt: z.string().trim().min(1).max(60).optional(),
  })
  .superRefine((v, ctx) => {
    const types: Record<MediaKind, readonly string[]> = { photo: ALLOWED_PHOTO_TYPES, video: ALLOWED_VIDEO_TYPES, voice: ALLOWED_AUDIO_TYPES };
    if (!types[v.kind].includes(v.contentType)) ctx.addIssue({ code: 'custom', path: ['contentType'], message: `Not a ${v.kind} file type` });
    const max = v.kind === 'photo' ? MAX_PHOTO_BYTES : v.kind === 'video' ? MAX_VIDEO_BYTES : MAX_VOICE_BYTES;
    if (v.byteSize > max) ctx.addIssue({ code: 'custom', path: ['byteSize'], message: 'File is too big' });
    if (v.kind !== 'voice' && !v.thumbByteSize) ctx.addIssue({ code: 'custom', path: ['thumbByteSize'], message: 'Add a preview' });
    if (v.kind !== 'photo' && !v.durationMs) ctx.addIssue({ code: 'custom', path: ['durationMs'], message: 'Add the length' });
    if (v.kind === 'voice' && (v.durationMs ?? 0) > VOICE_LIMIT_MS) ctx.addIssue({ code: 'custom', path: ['durationMs'], message: 'Too long' });
  });
export type CreateUploadInput = z.input<typeof createUploadSchema>;

export type UploadTarget = { url: string; headers: Record<string, string> };

export type UploadTicket = {
  photoId: string;
  status: PhotoStatus;
  /** Both null when this clientUploadId was already completed — nothing left to send. */
  original: UploadTarget | null;
  thumb: UploadTarget | null;
  preview: UploadTarget | null;
  /** Set instead of `original` for big files. Send `parts` back when finishing. */
  multipart: { uploadId: string; partBytes: number; parts: { number: number; url: string }[] } | null;
};

/** Finishing an upload: the pieces of a big file, with the tag storage returned for each. */
export const completeUploadSchema = z
  .object({ parts: z.array(z.object({ number: z.number().int().positive().max(10_000), etag: z.string().min(1).max(200) })).max(10_000).optional() })
  .optional();
export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;

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
/** `me`: photos you're in (Find my photos); `mine`: photos you took. */
export const PHOTO_LIST_FILTERS = ['all', 'photographers', 'guests', 'mine', 'me', 'review', 'hidden'] as const;
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
  kind: MediaKind;
  /** Videos and voice notes. */
  durationMs: number | null;
  /** Short-lived signed URLs. Voice notes have no thumbnail. */
  thumbUrl: string | null;
  /** What to show when it's opened; null for older photos (use `url`). */
  previewUrl: string | null;
  url: string | null;
};

export type Page<T> = { items: T[]; nextCursor: string | null };

// ---------- errors ----------

export type ApiError = { statusCode: number; message: string; code?: ApiErrorCode };

/** Machine-readable reasons the app reacts to (instead of matching on message text). */
export type ApiErrorCode =
  | 'PHOTO_LIMIT_REACHED'
  | 'VIDEO_LIMIT_REACHED'
  | 'VOICE_LIMIT_REACHED'
  | 'PHOTOGRAPHER_SLOTS_FULL'
  | 'LIBRARY_UPLOADS_OFF'
  | 'SHOOTING_NOT_OPEN'
  | 'SHOOTING_CLOSED'
  | 'DOWNLOADS_OFF';

// ---------- find my photos ----------

/**
 * Faceprints are made on the phone: YuNet (OpenCV Zoo, MIT) finds each face and its 5 points,
 * SFace (OpenCV Zoo, Apache-2.0) turns the aligned 112×112 face into 128 numbers. Only prints
 * from the same model can be compared, so the model is named on every one.
 */
export const FACE_MODEL = 'sface-2021dec-int8';
export const FACE_EMBEDDING_SIZE = 128;
/** Cosine similarity at or above this counts as the same person (OpenCV's value for SFace). */
export const FACE_MATCH_THRESHOLD = 0.363;
/** More faces than this in one photo are left out (crowd shots). */
export const MAX_FACES_PER_PHOTO = 40;

const embedding = z.array(z.number().finite()).length(FACE_EMBEDDING_SIZE);

/** The faces a phone found in a photo (an empty list is fine: "no faces"). */
export const saveFacesSchema = z.object({
  model: z.literal(FACE_MODEL),
  faces: z
    .array(z.object({ box: z.array(z.number().min(0).max(1)).length(4), embedding }))
    .max(MAX_FACES_PER_PHOTO),
});
export type SaveFacesInput = z.infer<typeof saveFacesSchema>;

/** A guest opts in with the faceprint of their selfie (the selfie stays on the phone). */
export const faceProfileSchema = z.object({
  model: z.literal(FACE_MODEL),
  embedding,
  /** They agreed to the Find my photos terms. */
  consent: z.literal(true),
});
export type FaceProfileInput = z.infer<typeof faceProfileSchema>;

/** A photo still waiting for its faces to be looked for (the host's phone does older ones). */
export type PendingFaceScan = { id: string; url: string };
