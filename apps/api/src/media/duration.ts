/**
 * The length of an uploaded video or voice note, read from the file itself: MP4, MOV and M4A
 * are all ISO base media files whose `moov` box holds a `mvhd` (movie header) with a timescale
 * and a duration. Only box headers and the `moov` box are fetched, never the whole file, so
 * this costs a few small ranged reads even for a 2 GB video.
 */
export type RangeReader = (start: number, end: number) => Promise<Buffer>;

/** `moov` is small (an index of the samples); anything bigger than this isn't one we'll read. */
const MAX_MOOV_BYTES = 32 * 1024 * 1024;

type Box = { type: string; start: number; headerSize: number; size: number };

function readBox(buf: Buffer, offset: number, fileSize: number, base = 0): Box | null {
  if (offset + 8 > buf.length) return null;
  let size = buf.readUInt32BE(offset);
  const type = buf.toString('latin1', offset + 4, offset + 8);
  let headerSize = 8;
  if (size === 1) {
    if (offset + 16 > buf.length) return null;
    size = Number(buf.readBigUInt64BE(offset + 8));
    headerSize = 16;
  } else if (size === 0) {
    size = fileSize - (base + offset);
  }
  if (size < headerSize) return null;
  return { type, start: base + offset, headerSize, size };
}

/** Duration in milliseconds, or null if this isn't a file we can read. */
export async function mediaDurationMs(read: RangeReader, fileSize: number): Promise<number | null> {
  // Walk the top-level boxes (ftyp, mdat, moov, ...) by their headers until we find moov.
  let pos = 0;
  for (let i = 0; i < 64 && pos + 8 <= fileSize; i++) {
    const head = await read(pos, Math.min(pos + 15, fileSize - 1));
    const box = readBox(head, 0, fileSize, pos);
    if (!box) return null;
    if (box.type === 'moov') {
      if (box.size > MAX_MOOV_BYTES) return null;
      const moov = await read(box.start, box.start + box.size - 1);
      return mvhdDuration(moov.subarray(box.headerSize));
    }
    pos = box.start + box.size;
  }
  return null;
}

function mvhdDuration(moov: Buffer): number | null {
  let offset = 0;
  while (offset + 8 <= moov.length) {
    const box = readBox(moov, offset, moov.length);
    if (!box) return null;
    if (box.type === 'mvhd') {
      const body = box.start + box.headerSize;
      const version = moov.readUInt8(body);
      // version 0: 32-bit creation/modification times; version 1: 64-bit.
      const timescale = moov.readUInt32BE(body + (version === 1 ? 20 : 12));
      const duration = version === 1 ? Number(moov.readBigUInt64BE(body + 24)) : moov.readUInt32BE(body + 16);
      if (!timescale) return null;
      return Math.round((duration / timescale) * 1000);
    }
    offset = box.start + box.size;
  }
  return null;
}
