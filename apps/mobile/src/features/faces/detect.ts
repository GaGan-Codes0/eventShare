/**
 * Finds the faces in a photo and makes a faceprint of each, all on this phone. The photo never
 * leaves the phone for this; only the faceprints (128 numbers each) and face boxes are sent.
 */
import { MAX_FACES_PER_PHOTO } from '@eventshare/shared';
import { AlphaType, ColorType, Skia, type SkCanvas } from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { loadModel, type Session } from '../../../modules/face-runtime';

import { ALIGN_SIZE, DETECT_SIZE, alignTransform, decodeYunet, normalise, toPlanar, type Point } from './math';

/** The photo is shrunk to this first: plenty for faces, and quick to decode. */
const WORK_EDGE = 1600;

export type FoundFace = {
  /** x, y, width, height as fractions of the photo. */
  box: [number, number, number, number];
  embedding: number[];
};

let sessions: Promise<{ detect: Session; recognise: Session }> | null = null;

async function modelPath(module: number) {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  return (asset.localUri ?? asset.uri).replace(/^file:\/\//, '');
}

/** The two models, loaded once and kept. */
function models() {
  sessions ??= (async () => {
    const [detect, recognise] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- bundled model files
      loadModel(await modelPath(require('../../../assets/models/face_detection_yunet_2023mar.onnx'))),
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- bundled model files
      loadModel(await modelPath(require('../../../assets/models/face_recognition_sface_2021dec_int8.onnx'))),
    ]);
    return { detect, recognise };
  })().catch((err: unknown) => {
    sessions = null;
    throw err;
  });
  return sessions;
}

/** Draws (part of) the image into a size×size square and hands back its RGBA pixels. */
function pixels(size: number, draw: (canvas: SkCanvas) => void) {
  const surface = Skia.Surface.Make(size, size);
  if (!surface) throw new Error('Could not make a drawing surface');
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('black'));
  draw(canvas);
  surface.flush();
  const px = surface
    .makeImageSnapshot()
    .readPixels(0, 0, { width: size, height: size, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
  surface.dispose();
  if (!px) throw new Error('Could not read the pixels');
  return px as Uint8Array;
}

/** An upright JPEG of the photo, at most WORK_EDGE on its long side (HEIC and rotation handled). */
async function workingCopy(uri: string) {
  const rendered = await ImageManipulator.manipulate(uri, { maxWidth: WORK_EDGE, maxHeight: WORK_EDGE }).renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
  return saved.uri;
}

/** Every face in the photo at `uri` (a local file, or a URL to download first), biggest-scoring first. */
export async function findFaces(uri: string): Promise<FoundFace[]> {
  const { detect, recognise } = await models();
  let local = uri;
  let downloaded: File | null = null;
  if (/^https?:/.test(uri)) {
    downloaded = await File.downloadFileAsync(uri, new File(Paths.cache, `face-${Date.now()}.jpg`), { idempotent: true });
    local = downloaded.uri;
  }
  const working = await workingCopy(local);
  try {
    const image = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(working));
    if (!image) throw new Error('Could not open the photo');
    const W = image.width();
    const H = image.height();
    const scale = DETECT_SIZE / Math.max(W, H);

    const small = pixels(DETECT_SIZE, (c) =>
      c.drawImageRect(image, Skia.XYWHRect(0, 0, W, H), Skia.XYWHRect(0, 0, W * scale, H * scale), Skia.Paint()),
    );
    const out = await detect.run(toPlanar(small, DETECT_SIZE, 'bgr'), [1, 3, DETECT_SIZE, DETECT_SIZE]);
    const faces = decodeYunet(out).slice(0, MAX_FACES_PER_PHOTO);

    const found: FoundFace[] = [];
    for (const f of faces) {
      const points = f.points.map(([x, y]) => [x / scale, y / scale] as Point);
      const [a, b, tx, ty] = alignTransform(points);
      const crop = pixels(ALIGN_SIZE, (c) => {
        c.concat(Skia.Matrix([a, -b, tx, b, a, ty, 0, 0, 1]));
        c.drawImage(image, 0, 0, Skia.Paint());
      });
      const res = await recognise.run(toPlanar(crop, ALIGN_SIZE, 'rgb'), [1, 3, ALIGN_SIZE, ALIGN_SIZE]);
      const [x, y, w, h] = f.box.map((v) => v / scale);
      found.push({
        box: [clamp(x! / W), clamp(y! / H), clamp(w! / W), clamp(h! / H)],
        embedding: normalise(res.fc1!),
      });
    }
    return found;
  } finally {
    for (const u of [working, downloaded?.uri]) {
      if (!u) continue;
      const f = new File(u);
      if (f.exists) f.delete();
    }
  }
}

function clamp(v: number) {
  return Math.min(1, Math.max(0, v));
}
