import { createContext, use } from 'react';
import { StyleSheet, Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import type { ColorToken, TypeVariant } from '@/constants/theme';
import { useTheme } from '@/theme';

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  color?: ColorToken;
  /** Italic serif emphasis — use inside a serif headline: <Text variant="h1">Our day, <Text emphasis>every way.</Text></Text> */
  emphasis?: boolean;
  align?: 'left' | 'center' | 'right';
};

/** True inside another Text: a nested span can't take padding, its outer line gives the room. */
const Nested = createContext(false);

const HEADINGS = new Set<TypeVariant>(['display', 'h1', 'h2', 'h3']);
/** Faces whose letters lean or swash past their own box (italics, scripts). */
const LEANING = /Italic|Pinyon|Script/i;

/**
 * Italic and script letters (an event's Bodoni, Cormorant or Pinyon name, the "everyone's." in a
 * headline) draw a little past the edges of their text box, and phones clip whatever is outside
 * it: a first "T" loses its left side, a closing quote or apostrophe its right. Headings and
 * leaning faces get room on every side, given back with an equal negative margin, so the letters
 * show whole and the layout doesn't move.
 */
function overhangRoom(style: TextStyle): TextStyle {
  const size = style.fontSize ?? 15;
  const x = Math.ceil(size * 0.14);
  const y = Math.ceil(size * 0.08);
  return { paddingHorizontal: x, marginHorizontal: -x, paddingVertical: y, marginVertical: -y };
}

export function Text({ variant = 'body', color, emphasis, align, style, ...rest }: TextProps) {
  const { colors, fonts, type: typeScale } = useTheme();
  const nested = use(Nested);
  const emphasisStyle = emphasis
    ? { fontFamily: fonts.serifItalic, color: colors[color ?? 'accent'] }
    : null;
  const flat = StyleSheet.flatten([typeScale[variant], emphasisStyle, style]) as TextStyle;
  // The outermost line of text gets the room: when it's a heading or leans, or holds a leaning span.
  const room = !nested && !emphasis && (HEADINGS.has(variant) || LEANING.test(String(flat.fontFamily ?? '')) || hasLeaningChild(rest.children)) ? overhangRoom(flat) : null;
  return (
    <RNText
      maxFontSizeMultiplier={1.3}
      style={[
        typeScale[variant],
        { color: colors[color ?? (variant === 'eyebrow' ? 'subtle' : 'ink')] },
        align && { textAlign: align },
        emphasisStyle,
        room,
        style,
      ]}
      {...rest}>
      <Nested value>{rest.children}</Nested>
    </RNText>
  );
}

/** A direct child span in a leaning face (or emphasis), so the line around it needs the room too. */
function hasLeaningChild(children: React.ReactNode): boolean {
  let found = false;
  const visit = (c: React.ReactNode) => {
    if (found || !c || typeof c !== 'object') return;
    if (Array.isArray(c)) return c.forEach(visit);
    const props = (c as { props?: { emphasis?: boolean; style?: TextStyle } }).props;
    if (!props) return;
    const family = (StyleSheet.flatten(props.style) as TextStyle | undefined)?.fontFamily;
    if (props.emphasis || LEANING.test(String(family ?? ''))) found = true;
  };
  visit(children);
  return found;
}
