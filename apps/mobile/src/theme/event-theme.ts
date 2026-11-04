/**
 * Event themes: the host picks one of six looks (two of them dark), optionally their own accent
 * colour, a heading font and a poster frame. The server stores only those choices (EventTheme);
 * the full palette is built here.
 */
import type { EventTheme, FontPairing, PosterFrame, ThemePreset } from '@eventshare/shared';

import { colors, fonts, typeScale, type Fonts, type Palette, type TypeScale } from '@/constants/theme';

export type Theme = {
  colors: Palette;
  fonts: Fonts;
  type: TypeScale;
  frame: PosterFrame;
  /** Light text on dark backgrounds: the status bar and a few photo overlays follow it. */
  dark: boolean;
};

export function createTheme(palette: Palette, fontSet: Fonts, frame: PosterFrame = 'none', heading = 1, dark = false): Theme {
  return { colors: palette, fonts: fontSet, type: typeScale(fontSet, heading), frame, dark };
}

/** eventShare's own look, used outside any event and until an event's theme loads. */
export const defaultTheme = createTheme(colors, fonts);

// ---------- colour ----------

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** `a` moved `t` of the way towards `b`. */
function mix(a: string, b: string, t: number) {
  const [x, y] = [channels(a), channels(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function luminance(hex: string) {
  const [r, g, b] = channels(hex).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function rgba(hex: string, alpha: number) {
  return `rgba(${channels(hex).join(',')},${alpha})`;
}

/** Text that reads on a button of this colour. */
export function onColor(hex: string) {
  return luminance(hex) > 0.55 ? '#141414' : '#FFFFFF';
}

/** The few colours that define a look; everything else is derived from them. */
type Look = { bg: string; surface: string; ink: string; muted: string; line: string; soft: string; accent: string; on: string };

export const PRESETS: Record<ThemePreset, Look & { name: string }> = {
  sage: { name: 'Sage & ivory', bg: '#FAF9F5', surface: '#FFFEFA', ink: '#273C32', muted: '#727868', line: '#E3E4D8', soft: '#E9EDDF', accent: '#385447', on: '#FFFEFA' },
  blush: { name: 'Blush & rose', bg: '#FBF5F3', surface: '#FFFCFB', ink: '#3D2428', muted: '#8A7376', line: '#EEDEDB', soft: '#F6E3DF', accent: '#A3455A', on: '#FFFFFF' },
  marigold: { name: 'Marigold', bg: '#FFF8EC', surface: '#FFFDF8', ink: '#3B2413', muted: '#85705A', line: '#EFE0C4', soft: '#FBE8C6', accent: '#C4521A', on: '#FFFFFF' },
  midnight: { name: 'Midnight & gold', bg: '#11151E', surface: '#1A202D', ink: '#F2EDDE', muted: '#A6A293', line: '#2B3244', soft: '#232A3A', accent: '#D6B36C', on: '#11151E' },
  navy: { name: 'Boardroom', bg: '#F4F6F9', surface: '#FFFFFF', ink: '#0E1A2C', muted: '#5F6B7E', line: '#DDE3EB', soft: '#E5ECF7', accent: '#1F4FD1', on: '#FFFFFF' },
  graphite: { name: 'Graphite & lime', bg: '#101210', surface: '#191C19', ink: '#EDF0E8', muted: '#9AA196', line: '#2A2E2A', soft: '#222622', accent: '#C3EE4F', on: '#101210' },
};

export const isDarkLook = (preset: ThemePreset) => luminance(PRESETS[preset].bg) < 0.2;

/** Every colour the app uses, from a look and an optional accent of the host's own. */
function paletteFrom(look: Look, accentOverride: string | null): Palette {
  const accent = accentOverride ?? look.accent;
  const on = accentOverride ? onColor(accentOverride) : look.on;
  const dark = luminance(look.bg) < 0.2;
  return {
    ...colors,
    paper: look.bg,
    surface: look.surface,
    surfaceBar: mix(look.surface, look.bg, 0.5),
    ink: look.ink,
    // The photo viewer's backdrop: always near-black.
    inkDeep: dark ? mix(look.bg, '#000000', 0.35) : mix(look.ink, '#000000', 0.15),
    primary: accent,
    primaryPressed: mix(accent, dark ? '#FFFFFF' : '#000000', 0.14),
    onPrimary: on,
    muted: look.muted,
    subtle: mix(look.muted, look.bg, 0.25),
    accent: dark ? accent : mix(accent, look.muted, 0.45),
    line: look.line,
    lineStrong: mix(look.line, look.ink, 0.08),
    sage: look.soft,
    sageDeep: mix(look.soft, accent, 0.35),
    field: mix(look.soft, look.surface, 0.45),
    warm: look.soft,
    warmDeep: mix(look.soft, look.ink, 0.1),
    viewfinder: dark ? mix(look.surface, accent, 0.12) : mix(accent, '#000000', 0.25),
    viewfinderText: dark ? look.ink : mix(look.bg, accent, 0.06),
    viewfinderAccent: dark ? accent : mix(accent, '#FFFFFF', 0.62),
    danger: dark ? mix(colors.danger, '#FFFFFF', 0.35) : colors.danger,
    dangerBg: mix(colors.danger, look.bg, 0.82),
    notice: dark ? mix(colors.notice, '#FFFFFF', 0.35) : colors.notice,
    noticeBg: mix(colors.notice, look.bg, 0.82),
    overlay: dark ? 'rgba(0,0,0,0.55)' : rgba(look.ink, 0.4),
    photoShade: rgba(mix(accent, '#000000', 0.7), 0.78),
  };
}

// ---------- fonts ----------

type FontSet = { label: string; fonts: Fonts; scale: number };

/** Keys must be loaded in src/app/_layout.tsx. Body text stays DM Sans; headings change. */
const FONT_SETS: Record<FontPairing, FontSet> = {
  classic: { label: 'Classic', fonts, scale: 1 },
  romantic: {
    label: 'Romantic',
    fonts: { ...fonts, serif: 'CormorantGaramond_500Medium_Italic', serifItalic: 'CormorantGaramond_500Medium_Italic' },
    scale: 1.1,
  },
  script: { label: 'Script', fonts: { ...fonts, serif: 'PinyonScript_400Regular', serifItalic: 'PinyonScript_400Regular' }, scale: 1.12 },
  editorial: {
    label: 'Editorial',
    fonts: { ...fonts, serif: 'BodoniModa_500Medium_Italic', serifItalic: 'BodoniModa_500Medium_Italic' },
    scale: 0.94,
  },
  modern: { label: 'Modern', fonts: { ...fonts, serif: 'SpaceGrotesk_600SemiBold', serifItalic: 'SpaceGrotesk_600SemiBold' }, scale: 0.86 },
  bold: { label: 'Statement', fonts: { ...fonts, serif: 'Syne_800ExtraBold', serifItalic: 'Syne_800ExtraBold' }, scale: 0.8 },
};

export const FONT_PAIRING_LABEL = Object.fromEntries(
  Object.entries(FONT_SETS).map(([k, v]) => [k, v.label]),
) as Record<FontPairing, string>;

export function headingFont(pairing: FontPairing) {
  return FONT_SETS[pairing].fonts.serif;
}

export function headingScale(pairing: FontPairing) {
  return FONT_SETS[pairing].scale;
}

export const POSTER_FRAME_LABEL: Record<PosterFrame, string> = {
  none: 'None',
  line: 'Line',
  double: 'Double',
  polaroid: 'Polaroid',
};

// ---------- themes ----------

/** eventShare's own choices, as a theme the host can start from. */
export const DEFAULT_EVENT_THEME: EventTheme = { preset: 'sage', accent: null, fonts: 'classic', frame: 'none' };

const built = new Map<string, Theme>();

/** The theme to draw an event with. Same choices, same object, so styles are built once. */
export function themeFor(theme: EventTheme | null | undefined): Theme {
  if (!theme) return defaultTheme;
  const key = `${theme.preset}|${theme.accent ?? ''}|${theme.fonts}|${theme.frame}`;
  let t = built.get(key);
  if (!t) {
    const set = FONT_SETS[theme.fonts];
    // Sage with no accent of its own is exactly eventShare's look.
    const palette = theme.preset === 'sage' && !theme.accent ? colors : paletteFrom(PRESETS[theme.preset], theme.accent);
    t = createTheme(palette, set.fonts, theme.frame, set.scale, isDarkLook(theme.preset));
    built.set(key, t);
  }
  return t;
}
