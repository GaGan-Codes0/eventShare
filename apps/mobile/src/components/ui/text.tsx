import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, fonts, type as typeScale, type ColorToken, type TypeVariant } from '@/constants/theme';

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  color?: ColorToken;
  /** Italic serif emphasis — use inside a serif headline: <Text variant="h1">Our day, <Text emphasis>every way.</Text></Text> */
  emphasis?: boolean;
  align?: 'left' | 'center' | 'right';
};

export function Text({ variant = 'body', color, emphasis, align, style, ...rest }: TextProps) {
  const emphasisStyle = emphasis
    ? { fontFamily: fonts.serifItalic, color: colors[color ?? 'accent'] }
    : null;
  return (
    <RNText
      maxFontSizeMultiplier={1.3}
      style={[
        typeScale[variant],
        { color: colors[color ?? (variant === 'eyebrow' ? 'subtle' : 'ink')] },
        align && { textAlign: align },
        emphasisStyle,
        style,
      ]}
      {...rest}
    />
  );
}
