import type { EventDetail } from '@eventshare/shared';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect, useRef } from 'react';

import { FocusStatusBar } from '@/components/focus-status-bar';
import { toast } from '@/components/toast';
import { TabBar } from '@/components/tab-bar';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { useLiveEvent } from '@/features/gallery/live';
import { ThemeProvider, useCurrentEventTheme } from '@/theme';

/**
 * One open event, in its host's theme. Guests and photographers get Home / Camera / Album; the
 * host gets Overview / Gallery / Design / People / Rules (or the guest tabs, in guest view).
 */
export default function EventTabs() {
  const theme = useCurrentEventTheme();
  const { id, event, managing } = useCurrentEvent();
  useLiveEvent(id, event?.memberCount ?? 0);
  // The moment the hosts add shots, say so, wherever the guest is in the event.
  const seen = useRef<{ status: EventDetail['refillStatus']; limit: number | null } | null>(null);
  useEffect(() => {
    if (!event) return;
    const before = seen.current;
    seen.current = { status: event.refillStatus, limit: event.photoLimit };
    if (before?.status === 'pending' && event.refillStatus === null && event.photoLimit !== null && before.limit !== null && event.photoLimit > before.limit) {
      toast(`The hosts added ${event.photoLimit - before.limit} shots to your roll`);
    }
  }, [event]);
  return (
    <ThemeProvider theme={theme}>
      {/* Light status bar text on dark event themes. */}
      <FocusStatusBar style={theme.dark ? 'light' : 'dark'} />
      <Tabs
        tabBar={(props) => <TabBar {...props} isHost={managing} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.colors.paper } }}>
        <Tabs.Screen name="home" />
        <Tabs.Screen name="camera" />
        <Tabs.Screen name="album" />
        <Tabs.Screen name="overview" />
        <Tabs.Screen name="gallery" />
        <Tabs.Screen name="design" />
        <Tabs.Screen name="people" />
        <Tabs.Screen name="rules" />
      </Tabs>
    </ThemeProvider>
  );
}
