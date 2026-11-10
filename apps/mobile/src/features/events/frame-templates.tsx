import type { FrameStyle, FrameTemplate } from '@eventshare/shared';
import { Image } from 'expo-image';
import type { ComponentRef, Ref } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { FRAMED_COPY_WIDTH } from './event-frame';
import { EventLogo } from './event-images';

/** Designed on an 1800 × 2400 canvas (3:4, the camera's shape) and laid out at any width. */
const CANVAS_W = 1800;
const CANVAS_H = 2400;
export const TEMPLATE_RATIO = CANVAS_W / CANVAS_H;

type Box = { x: number; y: number; w: number; h: number };
type Layout = {
  /** Where the photo shows, and its corner radius. */
  window: Box & { r: number };
  /** Where the logo and message sit. */
  caption: Box;
  align: 'center' | 'left';
  serif: boolean;
  /** Message size on the canvas. */
  size: number;
};

const LAYOUTS: Record<FrameStyle, Layout> = {
  polaroid: { window: { x: 110, y: 110, w: 1580, h: 1800, r: 0 }, caption: { x: 110, y: 1930, w: 1580, h: 400 }, align: 'center', serif: true, size: 120 },
  classic: { window: { x: 150, y: 150, w: 1500, h: 1900, r: 40 }, caption: { x: 150, y: 2110, w: 1500, h: 260 }, align: 'center', serif: true, size: 100 },
  band: { window: { x: 60, y: 60, w: 1680, h: 2000, r: 0 }, caption: { x: 60, y: 2100, w: 1680, h: 240 }, align: 'left', serif: false, size: 76 },
  confetti: { window: { x: 130, y: 260, w: 1540, h: 1880, r: 60 }, caption: { x: 130, y: 60, w: 1540, h: 190 }, align: 'center', serif: true, size: 100 },
};

const DOTS = ['#E8505B', '#F9C74F', '#43AA8B', '#577590', '#F3722C'];

/** Light or dark text, whichever reads on the frame colour. */
export function frameInk(color: string) {
  const n = parseInt(color.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1E1E1E' : '#FFFFFF';
}

type Props = {
  ref?: Ref<ComponentRef<typeof View>>;
  template: FrameTemplate;
  /** The photo in the window; none shows an empty window (the Design tab preview). */
  uri: string | null;
  logoUrl: string | null;
  /** Laid-out width in points; full size by default (captured for saving). */
  width?: number;
  onPhotoLoad?: () => void;
};

/**
 * A ready-made frame the host styled: the photo in a window on the frame colour, with the event's
 * message and logo. Rendered as views and captured to an image when a guest saves.
 */
export function TemplateFrame({ ref, template, uri, logoUrl, width = FRAMED_COPY_WIDTH, onPhotoLoad }: Props) {
  const { fonts, colors } = useTheme();
  const k = width / CANVAS_W;
  const L = LAYOUTS[template.style];
  const ink = frameInk(template.color);
  const line = template.color === '#B8862F' ? '#FFFFFF' : '#D6B36C';
  const at = (b: Box) => ({ position: 'absolute' as const, left: b.x * k, top: b.y * k, width: b.w * k, height: b.h * k });
  const showLogo = template.logo && logoUrl;

  return (
    <View ref={ref} collapsable={false} style={{ width, height: CANVAS_H * k, backgroundColor: template.color, overflow: 'hidden' }}>
      <View style={[at(L.window), { borderRadius: L.window.r * k, overflow: 'hidden', backgroundColor: colors.field }]}>
        {uri && <Image source={{ uri }} style={{ flex: 1 }} contentFit="cover" onLoad={() => onPhotoLoad?.()} />}
      </View>

      {template.style === 'classic' && (
        <>
          <View style={[at({ x: 120, y: 120, w: 1560, h: 1960 }), { borderWidth: 6 * k, borderColor: line, borderRadius: 58 * k }]} />
          <View style={[at({ x: 96, y: 96, w: 1608, h: 2008 }), { borderWidth: Math.max(1, 2 * k), borderColor: line, borderRadius: 74 * k }]} />
        </>
      )}
      {template.style === 'confetti' &&
        Array.from({ length: 64 }, (_, i) => {
          // Dots only in the border: left and right strips, and the bottom edge.
          const side = i % 3;
          const t = ((i * 37) % 100) / 100;
          const x = side === 0 ? 30 + (i % 3) * 25 : side === 1 ? 1700 + (i % 3) * 25 : 60 + t * 1680;
          const y = side === 2 ? 2190 + (i % 4) * 45 : 280 + t * 1840;
          const r = 10 + (i % 4) * 5;
          return (
            <View
              key={i}
              style={{ position: 'absolute', left: (x - r) * k, top: (y - r) * k, width: 2 * r * k, height: 2 * r * k, borderRadius: r * k, backgroundColor: DOTS[i % DOTS.length] }}
            />
          );
        })}

      <View
        style={[
          at(L.caption),
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: L.align === 'center' ? 'center' : 'flex-start',
            gap: 40 * k,
            paddingHorizontal: (L.align === 'left' ? 0 : 40) * k,
          },
        ]}>
        {showLogo && <EventLogo uri={logoUrl} size={(L.align === 'left' ? 170 : 150) * k} />}
        {template.message ? (
          <Text
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            style={{
              flexShrink: 1,
              color: ink,
              textAlign: L.align === 'center' && !showLogo ? 'center' : 'left',
              fontFamily: L.serif ? fonts.serif : fonts.sans,
              fontWeight: L.serif ? undefined : '700',
              fontStyle: template.style === 'polaroid' ? 'italic' : 'normal',
              fontSize: L.size * k,
              lineHeight: L.size * 1.2 * k,
            }}>
            {template.message}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
