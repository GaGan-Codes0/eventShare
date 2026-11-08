import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  useFonts,
} from '@expo-google-fonts/dm-sans';
import { BodoniModa_500Medium_Italic } from '@expo-google-fonts/bodoni-moda';
import { CormorantGaramond_500Medium_Italic } from '@expo-google-fonts/cormorant-garamond';
// Clerk is switched off for now (own email + password login instead).
// import { ClerkProvider } from '@clerk/expo';
// import { tokenCache } from '@clerk/expo/token-cache';
import { DMSerifDisplay_400Regular, DMSerifDisplay_400Regular_Italic } from '@expo-google-fonts/dm-serif-display';
import { PinyonScript_400Regular } from '@expo-google-fonts/pinyon-script';
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk';
import { Syne_800ExtraBold } from '@expo-google-fonts/syne';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { router, Stack, type NativeStackNavigationOptions } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { Toaster } from '@/components/toast';
import { radius } from '@/constants/theme';
import { refreshNewest } from '@/features/gallery/live';
import { initUploadQueue, onPhotoUploaded, onSlotReserved, setAfterUpload } from '@/features/uploads/queue';
import { keys } from '@/services/api/hooks';
import { getSessionUser, loadSession, subscribeSession } from '@/services/api/session';
import { loadCurrentEvent } from '@/store/current-event';
import { loadPreferences } from '@/store/preferences';
import { defaultTheme, ThemeProvider, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

// const CLERK_KEY: string = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
// if (!CLERK_KEY) throw new Error('Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in apps/mobile/.env');

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 2 } },
});


/** Refresh the gallery whenever one of our queued photos goes live. */
function UploadSync() {
  const qc = useQueryClient();
  useEffect(
    () =>
      onPhotoUploaded((photo) => {
        // Just the newest photos and the totals, not every page of every gallery.
        refreshNewest(qc, photo.eventId).catch(() => undefined);
        void qc.invalidateQueries({ queryKey: keys.event(photo.eventId), exact: true });
      }),
    [qc],
  );
  // A queued photo just took one of your slots: refresh how many shots you have left.
  useEffect(() => onSlotReserved((eventId) => void qc.invalidateQueries({ queryKey: keys.event(eventId) })), [qc]);
  // Find my photos: each photo's faces are found on this phone, right after it's uploaded.
  useEffect(() => {
    setAfterUpload(async (item, photo, uri) => {
      if (photo.kind !== 'photo') return;
      // Loaded on first use, so the face models never slow the app's start.
      const { scanPhoto, scanningOn } = await import('@/features/faces/scan');
      if (scanningOn(qc, item.eventId)) await scanPhoto(photo.id, uri);
    });
    return () => setAfterUpload(null);
  }, [qc]);
  return null;
}

/** Signed out (tapped Sign out, or the login expired): clear cached data and go to sign in. */
function SessionWatch() {
  const qc = useQueryClient();
  useEffect(
    () =>
      subscribeSession(() => {
        if (getSessionUser()) return;
        qc.clear();
        // The signed-in screens are gone (Stack.Protected); start fresh on sign in.
        router.replace('/sign-in');
      }),
    [qc],
  );
  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSerifDisplay_400Regular,
    DMSerifDisplay_400Regular_Italic,
    // Heading fonts for event themes (src/theme/event-theme.ts).
    CormorantGaramond_500Medium_Italic,
    PinyonScript_400Regular,
    BodoniModa_500Medium_Italic,
    SpaceGrotesk_600SemiBold,
    Syne_800ExtraBold,
  });
  const [stateLoaded, setStateLoaded] = useState(false);

  useEffect(() => {
    void Promise.all([loadSession(), loadCurrentEvent(), loadPreferences()]).then(() => {
      setStateLoaded(true);
      void initUploadQueue();
    });
  }, []);

  useEffect(() => {
    if (fontsLoaded && stateLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded, stateLoaded]);

  if (!fontsLoaded || !stateLoaded) return null;

  return (
    // <ClerkProvider publishableKey={CLERK_KEY} tokenCache={tokenCache}>
    <QueryClientProvider client={queryClient}>
      {/* Lets screens keep the field being typed in above the keyboard, on Android too. */}
      <KeyboardProvider>
      <UploadSync />
      <SessionWatch />
      <ThemeProvider theme={defaultTheme}>
        <StatusBar style="dark" />
        <AppStack />
        <Toaster />
      </ThemeProvider>
      </KeyboardProvider>
    </QueryClientProvider>
    // </ClerkProvider>
  );
}

/** Every screen, with backgrounds from the current theme. */
function AppStack() {
  const { colors } = useTheme();
  const signedIn = useSyncExternalStore(subscribeSession, () => Boolean(getSessionUser()));
  const sheet = useMemo<NativeStackNavigationOptions>(
    () => ({
      presentation: 'formSheet',
      sheetGrabberVisible: true,
      sheetCornerRadius: radius.sheet,
      sheetAllowedDetents: [0.85],
      contentStyle: { backgroundColor: colors.paper },
    }),
    [colors],
  );
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
      <Stack.Screen name="index" />
      {/* Signed out, only sign-in exists; signed in, it doesn't. Switching drops the other side's
          history, so Back after signing out can't reach a signed-in screen (it leaves the app). */}
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="events" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="create-event" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="join" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="join-scan" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="join-code" />
        <Stack.Screen name="join-preview" options={{ animation: 'fade' }} />
        <Stack.Screen name="invite" options={sheet} />
        {/* As tall as its contents, like the prototype's profile sheet. */}
        <Stack.Screen name="profile" options={{ ...sheet, sheetAllowedDetents: 'fitToContents' }} />
        <Stack.Screen name="download" options={sheet} />
        <Stack.Screen name="find-me" options={{ ...sheet, sheetAllowedDetents: 'fitToContents' }} />
        <Stack.Screen
          name="photo/[id]"
          options={{ presentation: 'fullScreenModal', animation: 'fade', contentStyle: { backgroundColor: colors.inkDeep } }}
        />
      </Stack.Protected>
    </Stack>
  );
}
