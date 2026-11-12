import { File, type FileHandle, FileMode } from 'expo-file-system';

/** How much of the file to look through for the EXIF block: it sits near the start of JPEG and HEIC files. */
const HEAD = 512 * 1024;

const DATE_TAGS = new Set([0x0132, 0x9003, 0x9004]); // DateTime, DateTimeOriginal, DateTimeDigitized
const OFFSET_TAGS = new Set([0x9010, 0x9011, 0x9012]); // their time zones
const EXIF_IFD = 0x8769;

const pad = (n: number) => String(n).padStart(2, '0');

/** EXIF's "YYYY:MM:DD HH:MM:SS" and "+HH:MM", in the phone's local time. */
function exifStamps(now: Date) {
  const date = `${now.getFullYear()}:${pad(now.getMonth() + 1)}:${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const mins = -now.getTimezoneOffset();
  const zone = `${mins < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(mins) / 60))}:${pad(Math.abs(mins) % 60)}`;
  return { date, zone };
}

/**
 * Rewrites the photo's "taken on" dates in its EXIF block (in place, same length) to `now`.
 * Galleries sort by that date, so a photo saved weeks after the event would otherwise land among
 * that day's photos and get lost. Nothing else changes: not the picture, not the location.
 * Returns whether anything was rewritten.
 */
export function restampExif(bytes: Uint8Array, now = new Date()): boolean {
  // "Exif\0\0" followed by a TIFF header ("II*\0" little-endian or "MM\0*" big-endian).
  let tiff = -1;
  for (let i = 0; i + 10 < bytes.length; i++) {
    if (
      bytes[i] === 0x45 &&
      bytes[i + 1] === 0x78 &&
      bytes[i + 2] === 0x69 &&
      bytes[i + 3] === 0x66 &&
      bytes[i + 4] === 0 &&
      bytes[i + 5] === 0
    ) {
      const a = bytes[i + 6];
      const b = bytes[i + 7];
      if ((a === 0x49 && b === 0x49 && bytes[i + 8] === 0x2a) || (a === 0x4d && b === 0x4d && bytes[i + 9] === 0x2a)) {
        tiff = i + 6;
        break;
      }
    }
  }
  if (tiff < 0) return false;

  const little = bytes[tiff] === 0x49;
  const inside = (at: number, len: number) => at >= 0 && at + len <= bytes.length;
  const u16 = (at: number) => (little ? bytes[at] | (bytes[at + 1] << 8) : (bytes[at] << 8) | bytes[at + 1]);
  const u32 = (at: number) =>
    (little
      ? bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)
      : (bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;

  const { date, zone } = exifStamps(now);
  let changed = false;

  /** Writes an ASCII value over an existing one, keeping its length and closing null. */
  const write = (entry: number, text: string) => {
    if (u16(entry + 2) !== 2) return; // not ASCII
    const count = u32(entry + 4);
    const at = count <= 4 ? entry + 8 : tiff + u32(entry + 8);
    const len = Math.min(count - 1, text.length);
    if (len <= 0 || !inside(at, len)) return;
    for (let k = 0; k < len; k++) bytes[at + k] = text.charCodeAt(k);
    changed = true;
  };

  const walk = (ifd: number, depth: number) => {
    if (depth > 1 || !inside(ifd, 2)) return;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const entry = ifd + 2 + i * 12;
      if (!inside(entry, 12)) return;
      const tag = u16(entry);
      if (DATE_TAGS.has(tag)) write(entry, date);
      else if (OFFSET_TAGS.has(tag)) write(entry, zone);
      else if (tag === EXIF_IFD) walk(tiff + u32(entry + 8), depth + 1);
    }
  };
  walk(tiff + u32(tiff + 4), 0);
  return changed;
}

/** Seconds between 1904-01-01 (the movie clock's start) and 1970-01-01. */
const MOVIE_EPOCH = 2082844800;
const TIME_BOXES = ['mvhd', 'tkhd', 'mdhd'];
/** A movie's index is small; anything bigger isn't one we should load. */
const MOOV_MAX = 16 * 1024 * 1024;
/** A written date-time, e.g. Apple's creation date "2026-01-15T18:30:00+0530". */
const DATE_TEXT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/**
 * Rewrites a video's recording dates (in its `moov` box, in place, same length) to `now`: the
 * creation and modification times of the movie, its tracks and media, and written dates such as
 * Apple's `com.apple.quicktime.creationdate`. Returns whether anything was rewritten.
 */
export function restampMovie(moov: Uint8Array, now = new Date()): boolean {
  let changed = false;
  const seconds = Math.floor(now.getTime() / 1000) + MOVIE_EPOCH;
  const tag = (at: number, name: string) => [0, 1, 2, 3].every((k) => moov[at + k] === name.charCodeAt(k));
  const u32 = (at: number) => ((moov[at] << 24) | (moov[at + 1] << 16) | (moov[at + 2] << 8) | moov[at + 3]) >>> 0;
  const put = (at: number, value: number, bytes: 4 | 8) => {
    if (bytes === 8) {
      put(at, Math.floor(value / 2 ** 32), 4);
      put(at + 4, value >>> 0, 4);
      return;
    }
    moov[at] = (value >>> 24) & 255;
    moov[at + 1] = (value >>> 16) & 255;
    moov[at + 2] = (value >>> 8) & 255;
    moov[at + 3] = value & 255;
  };

  const local = exifStamps(now);
  const zone = local.zone.replace(':', '');
  const isoLocal = local.date.replace(/^(\d{4}):(\d{2}):(\d{2}) /, '$1-$2-$3T');
  const isoUtc = now.toISOString().slice(0, 19);

  for (let i = 4; i + 19 <= moov.length; i++) {
    // Movie, track and media headers: size, name, version, flags, then created and modified.
    if (i + 24 <= moov.length && TIME_BOXES.some((name) => tag(i, name))) {
      const size = u32(i - 4);
      const version = moov[i + 4];
      if (size >= 24 && i - 4 + size <= moov.length && (version === 0 || version === 1)) {
        const bytes = version === 1 ? 8 : 4;
        put(i + 8, seconds, bytes);
        put(i + 8 + bytes, seconds, bytes);
        changed = true;
      }
      continue;
    }
    // Written dates: same length, keeping how the time zone is written (Z, +0530 or +05:30).
    if (moov[i] >= 0x30 && moov[i] <= 0x39 && moov[i + 4] === 0x2d && moov[i + 10] === 0x54) {
      const text = String.fromCharCode(...moov.subarray(i, i + 25));
      if (!DATE_TEXT.test(text)) continue;
      const rest = text.slice(19);
      let stamp = isoLocal;
      if (rest.startsWith('Z')) stamp = isoUtc;
      else if (/^[+-]\d{2}:\d{2}/.test(rest)) stamp = isoLocal + local.zone;
      else if (/^[+-]\d{4}/.test(rest)) stamp = isoLocal + zone;
      for (let k = 0; k < stamp.length; k++) moov[i + k] = stamp.charCodeAt(k);
      changed = true;
      i += stamp.length - 1;
    }
  }
  return changed;
}

/** Finds the top-level `moov` box (at the start or the end of the file) and re-dates it. */
async function restampVideoFile(handle: FileHandle) {
  const end = handle.size ?? 0;
  let at = 0;
  while (at + 8 <= end) {
    handle.offset = at;
    const head = await handle.readBytes(16);
    let size = ((head[0] << 24) | (head[1] << 16) | (head[2] << 8) | head[3]) >>> 0;
    const name = String.fromCharCode(head[4], head[5], head[6], head[7]);
    if (size === 1)
      size =
        (((head[8] << 24) | (head[9] << 16) | (head[10] << 8) | head[11]) >>> 0) * 2 ** 32 +
        (((head[12] << 24) | (head[13] << 16) | (head[14] << 8) | head[15]) >>> 0);
    else if (size === 0) size = end - at;
    if (size < 8) return;
    if (name === 'moov') {
      if (size > MOOV_MAX) return;
      handle.offset = at;
      const moov = await handle.readBytes(size);
      if (restampMovie(moov)) {
        handle.offset = at;
        await handle.writeBytes(moov);
      }
      return;
    }
    at += size;
  }
}

/**
 * Dates a downloaded copy (photo or video) as saved now, so it shows at the top of the phone's
 * gallery. The copy is ours to change (the original on the server stays as it is). Best effort:
 * on any trouble it still saves, just with its original date.
 */
export async function dateAsSavedNow(uri: string, kind: 'photo' | 'video' = 'photo') {
  let handle: FileHandle | null = null;
  try {
    handle = new File(uri).open(FileMode.ReadWrite);
    if (kind === 'video') {
      await restampVideoFile(handle);
      return;
    }
    const head = await handle.readBytes(HEAD);
    if (restampExif(head)) {
      handle.offset = 0;
      await handle.writeBytes(head);
    }
  } catch {
    // Keep the original date rather than fail the save.
  } finally {
    handle?.close();
  }
}
