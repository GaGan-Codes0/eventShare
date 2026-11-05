import type { PhotoFilter } from '@eventshare/shared';
import { Canvas, ColorMatrix, Image as SkiaImage, ImageFormat, Skia, useImage } from '@shopify/react-native-skia';
import { useAssets } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

/**
 * The event's photo look. Originals are always stored untouched: the look is drawn on screen,
 * and only copies someone saves have it baked in.
 */
export const FILTER_LABEL: Record<PhotoFilter, string> = { natural: 'Natural', golden: 'Golden hour', mono: 'Mono', faded: 'Faded film' };

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SAMPLE = require('../../../assets/images/look-sample.jpg') as number;

/** A picture to show the looks on before an event has photos of its own (a file the look can read). */
export function useLookSample(): string | null {
  const [assets] = useAssets([SAMPLE]);
  return assets?.[0]?.localUri ?? null;
}

// 5×5 colour matrices (rows r, g, b, a, 1), the same steps as CSS filters, applied left to right.
type M = number[];
const identity = (): M => [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1];

function multiply(a: M, b: M): M {
  const out = new Array<number>(25).fill(0);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) for (let k = 0; k < 5; k++) out[r * 5 + c] += a[r * 5 + k] * b[k * 5 + c];
  return out;
}

const rgb = (m: number[][], offset = [0, 0, 0]): M => [...m[0], 0, offset[0], ...m[1], 0, offset[1], ...m[2], 0, offset[2], 0, 0, 0, 1, 0, 0, 0, 0, 0, 1];

function saturate(s: number): M {
  return rgb([
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
  ]);
}

function sepia(a: number): M {
  const k = 1 - a;
  return rgb([
    [0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k],
    [0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k],
    [0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k],
  ]);
}

const brightness = (b: number) => rgb([[b, 0, 0], [0, b, 0], [0, 0, b]]);
const contrast = (c: number) => rgb([[c, 0, 0], [0, c, 0], [0, 0, c]], [0.5 - 0.5 * c, 0.5 - 0.5 * c, 0.5 - 0.5 * c]);
const grayscale = (g: number) => saturate(1 - g);

/** Steps in CSS order; the first step touches the colour first. */
const chain = (...steps: M[]) => steps.reduce((acc, step) => multiply(step, acc), identity());

const MATRICES: Record<Exclude<PhotoFilter, 'natural'>, M> = {
  golden: chain(sepia(0.3), saturate(1.3), contrast(1.04), brightness(1.04)),
  mono: chain(grayscale(1), contrast(1.15)),
  faded: chain(contrast(0.84), brightness(1.1), saturate(0.7), sepia(0.12)),
};

/** Skia's 4×5 form (drops the constant last row). */
function skiaMatrix(filter: Exclude<PhotoFilter, 'natural'>) {
  return MATRICES[filter].slice(0, 20);
}

type Props = { uri: string | null | undefined; filter: PhotoFilter; fit?: 'cover' | 'contain'; style?: StyleProp<ImageStyle>; onLoad?: (w: number, h: number) => void };

/** A photo with the event's look, drawn as it's shown. Natural is a plain image. */
export function FilteredImage({ uri, filter, fit = 'cover', style, onLoad }: Props) {
  if (!uri) return <View style={style as StyleProp<ViewStyle>} />;
  if (filter === 'natural') {
    return (
      <Image
        source={{ uri }}
        style={style}
        contentFit={fit}
        transition={200}
        onLoad={(e) => onLoad?.(e.source.width, e.source.height)}
      />
    );
  }
  return <SkiaFiltered uri={uri} filter={filter} fit={fit} style={style} onLoad={onLoad} />;
}

function SkiaFiltered({ uri, filter, fit, style, onLoad }: Props & { filter: Exclude<PhotoFilter, 'natural'> }) {
  // If this phone can't decode the file for drawing (some HEIC), show it plain rather than not at all.
  const [failed, setFailed] = useState(false);
  const image = useImage(uri, () => setFailed(true));
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (image) onLoad?.(image.width(), image.height());
  }, [image, onLoad]);
  if (failed) return <FilteredImage uri={uri} filter="natural" fit={fit} style={style} onLoad={onLoad} />;
  return (
    <View style={style as StyleProp<ViewStyle>} onLayout={(e) => setSize(e.nativeEvent.layout)}>
      {image && size.width > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <SkiaImage image={image} x={0} y={0} width={size.width} height={size.height} fit={fit}>
            <ColorMatrix matrix={skiaMatrix(filter)} />
          </SkiaImage>
        </Canvas>
      ) : null}
    </View>
  );
}

/** Long edge of a saved filtered copy: full resolution for usual phone photos, bounded for memory. */
const MAX_EXPORT_EDGE = 4096;

/**
 * A full-quality copy of a photo with the look baked in, as a JPEG file. The original file is
 * only read. Returns null when this phone can't decode the file (then save the original).
 */
export async function exportFiltered(uri: string, filter: PhotoFilter): Promise<string | null> {
  if (filter === 'natural') return uri;
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) return null;
  const scale = Math.min(1, MAX_EXPORT_EDGE / Math.max(image.width(), image.height()));
  const width = Math.round(image.width() * scale);
  const height = Math.round(image.height() * scale);
  const surface = Skia.Surface.MakeOffscreen(width, height);
  if (!surface) return null;
  const paint = Skia.Paint();
  paint.setColorFilter(Skia.ColorFilter.MakeMatrix(skiaMatrix(filter)));
  surface
    .getCanvas()
    .drawImageRect(image, Skia.XYWHRect(0, 0, image.width(), image.height()), Skia.XYWHRect(0, 0, width, height), paint);
  surface.flush();
  const out = surface.makeImageSnapshot().encodeToBase64(ImageFormat.JPEG, 95);
  const file = new File(Paths.cache, `eventshare-look-${Date.now()}.jpg`);
  file.write(out, { encoding: 'base64' });
  return file.uri;
}
