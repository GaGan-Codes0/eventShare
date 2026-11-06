import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ArrowUpRight, ChevronLeft, ChevronRight, Hash, ScanLine } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { FocusStatusBar } from '@/components/focus-status-bar';
import { screenPadding, space } from '@/constants/theme';
import { useMe } from '@/services/api/hooks';
import { makeStyles, useTheme } from '@/theme';

/** Join: scan the host's QR, or type the code. Invite links (eventshare://join?code=…) skip straight to the invite. */
export default function Join() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const { code } = useLocalSearchParams<{ code?: string }>();
  if (code) return <Redirect href={{ pathname: '/join-preview', params: { code } }} />;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FocusStatusBar style="dark" />
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.heading}>
          <Text variant="eyebrow">Hi {me.data?.name.split(' ')[0] ?? 'there'}</Text>
          <Text variant="h1">
            Let’s get you <Text variant="h1" emphasis>in.</Text>
          </Text>
          <Text variant="caption" color="muted">
            Your host shared a QR code or a 6-digit code. Either one opens the event.
          </Text>
        </View>

        <Pressable accessibilityRole="button" onPress={() => router.push('/join-scan')} style={({ pressed }) => [styles.scan, pressed && { transform: [{ scale: 0.99 }] }]}>
          <View style={styles.scanIcon}>
            <ScanLine size={26} color={SAGE} />
          </View>
          <View style={styles.scanArrow}>
            <ArrowUpRight size={20} color={SAGE} />
          </View>
          <View style={styles.gap4}>
            <Text style={styles.scanTitle}>Scan the QR code</Text>
            <Text variant="caption" style={styles.scanCaption}>
              On your table card, invite or the venue screen
            </Text>
          </View>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={() => router.push('/join-code')} style={({ pressed }) => [styles.code, pressed && { backgroundColor: colors.field }]}>
          <View style={styles.codeIcon}>
            <Hash size={21} color={colors.ink} />
          </View>
          <View style={styles.flex}>
            <Text variant="bodyStrong">Enter event code</Text>
            <Text variant="caption" color="muted">
              6 digits from your host
            </Text>
          </View>
          <ChevronRight size={18} color={colors.ink} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const SAGE = '#CDD7AB';

const useStyles = makeStyles(({ colors, fonts }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  top: { height: 54, paddingHorizontal: space.sm, flexDirection: 'row', alignItems: 'center' },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: screenPadding, paddingTop: space.sm, paddingBottom: space['3xl'], gap: space.lg - 2 },
  heading: { gap: 6, marginBottom: space.xs },
  flex: { flex: 1, gap: 2 },
  gap4: { gap: space.xs },
  scan: { minHeight: 208, borderRadius: 22, backgroundColor: '#304538', padding: space.xl, justifyContent: 'space-between' },
  scanIcon: { width: 54, height: 54, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(205,215,171,0.35)', alignItems: 'center', justifyContent: 'center' },
  scanArrow: { position: 'absolute', top: space.xl, right: space.xl },
  scanTitle: { fontFamily: fonts.serif, fontSize: 27, lineHeight: 31, letterSpacing: -0.5, color: '#F4F2DF' },
  scanCaption: { color: 'rgba(244,242,223,0.78)' },
  code: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  codeIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.warm, alignItems: 'center', justifyContent: 'center' },
}));
