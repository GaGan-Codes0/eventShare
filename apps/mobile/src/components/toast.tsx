import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { radius, space } from '@/constants/theme';

/** A short note at the top of the screen ("That was your last shot"). Gone after a few seconds. */
let show: ((message: string) => void) | null = null;

export function toast(message: string) {
  show?.(message);
}

/** Mounted once, at the root. */
export function Toaster() {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    show = (m) => {
      clearTimeout(timer);
      setMessage(m);
      timer = setTimeout(() => setMessage(null), 2800);
    };
    return () => {
      show = null;
      clearTimeout(timer);
    };
  }, []);

  if (!message) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + space.sm }]}>
      <Animated.View key={message} entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(180)} style={styles.toast}>
        <Text variant="label" align="center" style={styles.text} accessibilityLiveRegion="polite">
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}

// Always dark, whatever the event's theme, so it reads over any screen.
const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.xl, right: space.xl, alignItems: 'center', zIndex: 90 },
  toast: {
    maxWidth: 320,
    paddingHorizontal: space.lg,
    paddingVertical: space.md - 2,
    borderRadius: radius.lg,
    backgroundColor: '#1E2B24',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  text: { color: '#F4F2DF' },
});
