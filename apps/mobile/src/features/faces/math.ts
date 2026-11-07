/**
 * The arithmetic of "Find my photos", with no React Native in it (so it can be checked on a
 * computer against the same models). Two OpenCV Zoo models:
 *
 *  - YuNet finds faces: a 640×640 BGR image (0–255) in, a score, box and five points (eyes,
 *    nose, mouth corners) per face out, on three grids (every 8, 16 and 32 pixels).
 *  - SFace makes a faceprint: a face turned upright and cropped to 112×112 RGB (0–255) in,
 *    128 numbers out. Two faceprints of the same person point the same way.
 */

export const DETECT_SIZE = 640;
export const ALIGN_SIZE = 112;
/** How sure YuNet must be that it's a face. OpenCV's own default. */
export const DETECT_SCORE = 0.9;
const NMS_IOU = 0.3;
/** Faces smaller than this (in the 640 image) are too blurry to recognise reliably. */
const MIN_FACE = 14;

export type Point = [number, number];
export type DetectedFace = {
  /** x, y, width, height in the 640×640 detection image. */
  box: [number, number, number, number];
  /** Right eye, left eye, nose tip, right and left mouth corners (as seen in the photo, left to right). */
  points: [Point, Point, Point, Point, Point];
  score: number;
};

/** RGBA pixels (as Skia or a decoder hands them over) → the planar float input each model wants. */
export function toPlanar(rgba: Uint8Array | Uint8ClampedArray, size: number, order: 'bgr' | 'rgb') {
  const n = size * size;
  const out = new Float32Array(3 * n);
  const [r, g, b] = order === 'bgr' ? [2, 1, 0] : [0, 1, 2];
  for (let i = 0; i < n; i++) {
    out[r * n + i] = rgba[i * 4]!;
    out[g * n + i] = rgba[i * 4 + 1]!;
    out[b * n + i] = rgba[i * 4 + 2]!;
  }
  return out;
}

type Outputs = Record<string, ArrayLike<number>>;

/** YuNet's raw grids → faces, best first, overlapping duplicates removed. */
export function decodeYunet(out: Outputs, scoreThreshold = DETECT_SCORE): DetectedFace[] {
  const found: DetectedFace[] = [];
  for (const stride of [8, 16, 32]) {
    const cls = out[`cls_${stride}`]!;
    const obj = out[`obj_${stride}`]!;
    const bbox = out[`bbox_${stride}`]!;
    const kps = out[`kps_${stride}`]!;
    const cols = DETECT_SIZE / stride;
    for (let idx = 0; idx < cls.length; idx++) {
      const score = Math.sqrt(clamp01(cls[idx]!) * clamp01(obj[idx]!));
      if (score < scoreThreshold) continue;
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      const cx = (c + bbox[idx * 4]!) * stride;
      const cy = (r + bbox[idx * 4 + 1]!) * stride;
      const w = Math.exp(bbox[idx * 4 + 2]!) * stride;
      const h = Math.exp(bbox[idx * 4 + 3]!) * stride;
      if (Math.min(w, h) < MIN_FACE) continue;
      const points = [0, 1, 2, 3, 4].map(
        (k) => [(kps[idx * 10 + 2 * k]! + c) * stride, (kps[idx * 10 + 2 * k + 1]! + r) * stride] as Point,
      ) as DetectedFace['points'];
      found.push({ box: [cx - w / 2, cy - h / 2, w, h], points, score });
    }
  }
  found.sort((a, b) => b.score - a.score);
  const kept: DetectedFace[] = [];
  for (const f of found) if (kept.every((k) => iou(k.box, f.box) < NMS_IOU)) kept.push(f);
  return kept;
}

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function iou(a: DetectedFace['box'], b: DetectedFace['box']) {
  const x1 = Math.max(a[0], b[0]);
  const y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[0] + a[2], b[0] + b[2]);
  const y2 = Math.min(a[1] + a[3], b[1] + b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return inter / (a[2] * a[3] + b[2] * b[3] - inter);
}

/** Where the five points sit in a 112×112 face SFace was trained on. */
const TEMPLATE: Point[] = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];

/**
 * The turn, scale and shift that best puts a face's five points on the template (Umeyama's
 * least-squares similarity). Returned as [a, b, tx, ty]: x' = a·x − b·y + tx, y' = b·x + a·y + ty.
 */
export function alignTransform(points: readonly Point[]): [number, number, number, number] {
  const n = points.length;
  let sx = 0, sy = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    sx += points[i]![0]; sy += points[i]![1];
    dx += TEMPLATE[i]![0]; dy += TEMPLATE[i]![1];
  }
  sx /= n; sy /= n; dx /= n; dy /= n;
  let num1 = 0, num2 = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const px = points[i]![0] - sx, py = points[i]![1] - sy;
    const qx = TEMPLATE[i]![0] - dx, qy = TEMPLATE[i]![1] - dy;
    num1 += px * qx + py * qy;
    num2 += px * qy - py * qx;
    den += px * px + py * py;
  }
  const a = num1 / den;
  const b = num2 / den;
  return [a, b, dx - (a * sx - b * sy), dy - (b * sx + a * sy)];
}

/** Scaled to length 1, so comparing two is a plain dot product. */
export function normalise(v: ArrayLike<number>) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i]! * v[i]!;
  const k = s > 0 ? 1 / Math.sqrt(s) : 0;
  return Array.from(v, (x) => x * k);
}

export function cosine(a: readonly number[], b: readonly number[]) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += a[i]! * b[i]!;
  return d;
}
