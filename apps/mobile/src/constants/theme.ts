/**
 * Design tokens — the only place colors, type, spacing and radii are defined.
 * Spec: docs/DESIGN.md. Never hard-code values in screens.
 *
 * Colors and fonts are eventShare's defaults; an event can swap them for its own theme, so
 * screens read them through `useTheme()` / `makeStyles()` from `@/theme`, never from here.
 * Spacing, radii and icon sizes never change per event: import those directly.
 */
import { Platform, type TextStyle } from 'react-native';

export const colors = {
  paper: '#FAF9F5',
  surface: '#FFFEFA',
  surfaceBar: '#FDFCF8',
  ink: '#273C32',
  inkDeep: '#243B2E',
  primary: '#385447',
  /** The accent as text and small icons: always readable on the page, even when the accent is pale. */
  primaryText: '#385447',
  primaryPressed: '#283F31',
  onPrimary: '#FFFEFA',
  muted: '#888B80',
  subtle: '#9A9D8A',
  accent: '#748063',
  line: '#E9E9DF',
  lineStrong: '#DEDFD3',
  sage: '#E9EDDF',
  sageDeep: '#A5B18F',
  field: '#F0F1E9',
  warm: '#F0EADD',
  warmDeep: '#E3D9C2',
  viewfinder: '#304538',
  viewfinderText: '#F4F2DF',
  viewfinderAccent: '#CDD7AB',
  danger: '#9F4C3E',
  dangerBg: '#F6E6DD',
  notice: '#806F46',
  noticeBg: '#F3E9D6',
  focus: '#A89057',
  overlay: 'rgba(24,42,36,0.4)',
  photoShade: 'rgba(19,39,31,0.78)',
  white: '#FFFFFF',
} as const;

export type ColorToken = keyof typeof colors;
/** A full set of colors for one theme (eventShare's own, or an event's). */
export type Palette = Record<ColorToken, string>;

/** Keys must match the useFonts() map in src/app/_layout.tsx. */
export const fonts = {
  serif: 'DMSerifDisplay_400Regular',
  serifItalic: 'DMSerifDisplay_400Regular_Italic',
  sans: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansSemiBold: 'DMSans_600SemiBold',
  sansBold: 'DMSans_700Bold',
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }),
} as const;

export type FontToken = keyof typeof fonts;
/** The font families for one theme. */
export type Fonts = Record<FontToken, string>;

/**
 * The type scale, set in a theme's fonts. Heading fonts differ in size at the same point size
 * (a script runs small, a heavy sans large), so a theme can scale its headings to even them out.
 */
export const typeScale = (fonts: Fonts, heading = 1) => ({
  display: { fontFamily: fonts.serif, fontSize: 40 * heading, lineHeight: 44 * heading, letterSpacing: -1 },
  h1: { fontFamily: fonts.serif, fontSize: 32 * heading, lineHeight: 36 * heading, letterSpacing: -1 },
  h2: { fontFamily: fonts.serif, fontSize: 24 * heading, lineHeight: 28 * heading, letterSpacing: -0.6 },
  h3: { fontFamily: fonts.serif, fontSize: 20 * heading, lineHeight: 24 * heading, letterSpacing: -0.4 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 17, lineHeight: 22, letterSpacing: -0.3 },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.sansSemiBold, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.sansMedium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
  eyebrow: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  mono: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16 },
}) satisfies Record<string, TextStyle>;

export type TypeScale = ReturnType<typeof typeScale>;
export type TypeVariant = keyof TypeScale;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 48,
} as const;

/** Horizontal padding for every screen. */
export const screenPadding = space.xl;

export const radius = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 18,
  sheet: 24,
  full: 999,
} as const;

export const icon = {
  stroke: 1.6,
  sm: 18,
  md: 20,
  lg: 22,
} as const;
