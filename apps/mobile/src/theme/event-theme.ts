/**
 * Event themes: the host picks a preset, or their own colour, plus fonts and a poster frame.
 * The server stores only those choices (EventTheme); the full palette is built here.
 */
import type { EventTheme, FontPairing, PosterFrame, ThemePreset } from '@eventshare/shared';

import { colors, fonts, typeScale, type Fonts, type Palette, type TypeScale } from '@/constants/theme';

export type Theme = { colors: Palette; fonts: Fonts; type: TypeScale; frame: PosterFrame };

export function createTheme(palette: Palette, fontSet: Fonts, frame: PosterFrame = 'none'): Theme {
  return { colors: palette, fonts: fontSet, type: typeScale(fontSet), frame };
}

/** eventShare's own look, used outside any event and until an event's theme loads. */
export const defaultTheme = createTheme(colors, fonts);

// ---------- colour ----------

type Hsl = { h: number; s: number; l: number };

function toHsl(hex: string): Hsl {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function toHex({ h, s, l }: Hsl): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function rgba(hex: string, alpha: number) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * A whole palette from one brand colour. Buttons use the colour itself, darkened until white
 * text on it is readable (WCAG AA); backgrounds and lines are faint tints of the same hue.
 */
export function paletteFromColor(hex: string): Palette {
  const { h, s } = toHsl(hex);
  // Greys and near-greys get neutral backgrounds instead of a muddy tint.
  const tinted = s < 0.08 ? 0 : 1;
  const tint = (sat: number, l: number, hue = h) => toHex({ h: hue, s: sat * tinted, l });

  const onPrimary = tint(0.4, 0.992);
  let primary = toHsl(hex);
  // Light colours get darker and a little calmer, or they turn neon by the time white text reads on them.
  while (contrast(toHex(primary), onPrimary) < 4.5 && primary.l > 0.05) {
    primary = { ...primary, l: primary.l - 0.02, s: primary.s * 0.97 };
  }
  const ink = toHex({ h, s: Math.min(s, 0.3), l: 0.2 });

  return {
    ...colors,
    paper: tint(0.28, 0.972),
    surface: onPrimary,
    surfaceBar: tint(0.3, 0.984),
    ink,
    inkDeep: toHex({ h, s: Math.min(s, 0.3), l: 0.16 }),
    primary: toHex(primary),
    primaryPressed: toHex({ ...primary, l: Math.max(primary.l - 0.07, 0.04) }),
    onPrimary,
    muted: tint(0.05, 0.5),
    subtle: tint(0.06, 0.58),
    accent: toHex({ h, s: Math.min(s, 0.22), l: 0.42 }),
    line: tint(0.16, 0.895),
    lineStrong: tint(0.14, 0.85),
    sage: tint(0.26, 0.915),
    sageDeep: tint(0.2, 0.63),
    field: tint(0.16, 0.935),
    warm: tint(0.35, 0.9, (h + 20) % 360),
    warmDeep: tint(0.3, 0.82, (h + 20) % 360),
    viewfinder: toHex({ h, s: Math.min(primary.s, 0.35), l: 0.22 }),
    viewfinderText: tint(0.45, 0.93),
    viewfinderAccent: tint(0.42, 0.78),
    overlay: rgba(ink, 0.4),
    photoShade: rgba(toHex({ h, s: Math.min(s, 0.35), l: 0.11 }), 0.78),
  };
}

// ---------- fonts ----------

/** Keys must be loaded in src/app/_layout.tsx. Body text stays DM Sans; headings change. */
const FONT_SETS: Record<FontPairing, Fonts> = {
  classic: fonts,
  modern: { ...fonts, serif: 'DMSans_700Bold', serifItalic: 'DMSans_700Bold_Italic' },
  elegant: { ...fonts, serif: 'PlayfairDisplay_500Medium', serifItalic: 'PlayfairDisplay_500Medium_Italic' },
  romantic: { ...fonts, serif: 'CormorantGaramond_600SemiBold', serifItalic: 'CormorantGaramond_600SemiBold_Italic' },
};

export const FONT_PAIRING_LABEL: Record<FontPairing, string> = {
  classic: 'Classic',
  modern: 'Modern',
  elegant: 'Elegant',
  romantic: 'Romantic',
};

export function headingFont(pairing: FontPairing) {
  return FONT_SETS[pairing].serif;
}

export const POSTER_FRAME_LABEL: Record<PosterFrame, string> = {
  none: 'None',
  line: 'Line',
  double: 'Double',
  polaroid: 'Polaroid',
};

// ---------- presets ----------

type Preset = { name: string; color: string; fonts: FontPairing; frame: PosterFrame };

export const PRESETS: Record<ThemePreset, Preset> = {
  evergreen: { name: 'Evergreen', color: colors.primary, fonts: 'classic', frame: 'none' },
  rose: { name: 'Rose', color: '#A2475E', fonts: 'romantic', frame: 'line' },
  marigold: { name: 'Marigold', color: '#B5701A', fonts: 'elegant', frame: 'double' },
  ocean: { name: 'Ocean', color: '#2F5D7C', fonts: 'modern', frame: 'line' },
  plum: { name: 'Plum', color: '#5B3A6E', fonts: 'elegant', frame: 'polaroid' },
  terracotta: { name: 'Terracotta', color: '#A4553A', fonts: 'classic', frame: 'polaroid' },
  charcoal: { name: 'Charcoal', color: '#3A3D42', fonts: 'modern', frame: 'none' },
};

/** A preset exactly as designed. */
export function presetTheme(preset: ThemePreset): EventTheme {
  const p = PRESETS[preset];
  return { preset, color: null, fonts: p.fonts, frame: p.frame };
}

/** Brand colours offered next to the free hex field. */
export const COLOR_SWATCHES = [
  '#385447', '#1F6F5C', '#2F5D7C', '#3B4F9A', '#5B3A6E', '#8E3B6B',
  '#A2475E', '#B3403A', '#A4553A', '#B5701A', '#7A6A2E', '#3A3D42',
] as const;

const built = new Map<string, Theme>();

/** The theme to draw an event with. Same choices, same object, so styles are built once. */
export function themeFor(theme: EventTheme | null | undefined): Theme {
  if (!theme) return defaultTheme;
  const key = `${theme.preset}|${theme.color ?? ''}|${theme.fonts}|${theme.frame}`;
  let t = built.get(key);
  if (!t) {
    const base = theme.color ?? (theme.preset === 'evergreen' ? null : PRESETS[theme.preset].color);
    t = createTheme(base ? paletteFromColor(base) : colors, FONT_SETS[theme.fonts], theme.frame);
    built.set(key, t);
  }
  return t;
}
