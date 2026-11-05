import { useIsFocused } from 'expo-router';
import { StatusBar, type StatusBarStyle } from 'expo-status-bar';

/**
 * The status bar style for the screen in front. Mounted only while the screen is focused, so
 * coming back to a screen puts its style back on top (a dark event theme can't leave light
 * text over a light page).
 */
export function FocusStatusBar({ style }: { style: StatusBarStyle }) {
  return useIsFocused() ? <StatusBar style={style} /> : null;
}
