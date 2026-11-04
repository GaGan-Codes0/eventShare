/**
 * The theme screens draw with: colors, fonts, the type scale and the poster frame. eventShare's
 * own look is the default; an event can supply its own (host themes), and everything under its
 * provider follows.
 *
 *   const useStyles = makeStyles(({ colors }) => ({ card: { backgroundColor: colors.surface } }));
 *   function Card() { const styles = useStyles(); ... }
 *
 * For one-off values in JSX (icon colors, pressed states) use `const { colors } = useTheme()`.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import { useCurrentEvent } from '@/features/events/use-current-event';

import { defaultTheme, themeFor, type Theme } from './event-theme';

export * from './event-theme';

const ThemeContext = createContext<Theme>(defaultTheme);

export function ThemeProvider({ theme, children }: { theme: Theme; children: ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** The open event's theme (eventShare's own while it loads or with no event open). */
export function useCurrentEventTheme() {
  return themeFor(useCurrentEvent().event?.theme);
}

type StyleMap = Record<string, ViewStyle | TextStyle | ImageStyle>;

/**
 * Styles that follow the theme. They're built once per theme and shared by every component
 * using them, so switching themes costs one rebuild, not one per render.
 */
export function makeStyles<T extends StyleMap>(factory: (theme: Theme) => T) {
  const built = new WeakMap<Theme, Readonly<T>>();
  return function useStyles(): Readonly<T> {
    const theme = useTheme();
    const cached = built.get(theme);
    if (cached) return cached;
    const styles = StyleSheet.create(factory(theme));
    built.set(theme, styles);
    return styles;
  };
}
