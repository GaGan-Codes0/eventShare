import { JOIN_CODE_LENGTH } from '@eventshare/shared';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Check, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { makeStyles } from '@/theme';

/** The code in a scanned invite: our join link, a web link with ?code=, or the bare code. */
export function codeFromScan(data: string): string | null {
  const fromLink = /[?&]code=([A-Za-z0-9-]+)/.exec(data)?.[1];
  const code = (fromLink ?? data).replace(/[\s-]/g, '');
  return code.length === JOIN_CODE_LENGTH && /^\d+$/.test(code) ? code : null;
}

const FRAME = { width: 232, height: 292 };

/** Point the camera at the host's QR: on a table card, an invite or the venue screen. */
export default function JoinScan() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [found, setFound] = useState(false);
  const done = useRef(false);
  const line = useSharedValue(0);
  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateY: line.get() * (FRAME.height - 24) }] }));

  useEffect(() => {
    line.set(withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [line]);

  function onScan(data: string) {
    if (done.current) return;
    const code = codeFromScan(data);
    if (!code) return;
    done.current = true;
    setFound(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => router.replace({ pathname: '/join-preview', params: { code } }), 450);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.close}>
          <X size={20} color={LIGHT} />
        </Pressable>
        <Text variant="title" style={styles.light}>
          Scan QR code
        </Text>
      </View>

      <View style={styles.finder}>
        {permission?.granted ? (
          <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={(r) => onScan(r.data)} />
        ) : (
          <View style={styles.ask}>
            <Text variant="h3" align="center" style={styles.light}>
              Allow the camera to scan
            </Text>
            <Text variant="caption" align="center" style={styles.dim}>
              Only to read the event’s QR code.
            </Text>
            <Button label="Enable camera" onPress={() => void requestPermission()} />
          </View>
        )}
        <View pointerEvents="none" style={styles.frame}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
          {!found && <Animated.View style={[styles.line, lineStyle]} />}
        </View>
        <View style={styles.status}>
          {found ? (
            <>
              <Check size={16} color={SAGE} />
              <Text variant="label" style={{ color: SAGE }}>
                Found your event
              </Text>
            </>
          ) : (
            <>
              <ActivityIndicator size="small" color={SAGE} />
              <Text variant="label" style={styles.light}>
                Looking for a code…
              </Text>
            </>
          )}
        </View>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.lg }]}>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/join-code')}>
          <Text variant="label" style={[styles.light, styles.underline]}>
            Enter the code instead
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const LIGHT = '#F4F2DF';
const SAGE = '#CDD7AB';

const useStyles = makeStyles(() => ({
  screen: { flex: 1, backgroundColor: '#0A0D0C' },
  top: { height: 54, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  light: { color: LIGHT },
  dim: { color: 'rgba(244,242,223,0.7)' },
  underline: { textDecorationLine: 'underline' },
  finder: { flex: 1, marginHorizontal: 14, marginTop: space.xs, borderRadius: 26, overflow: 'hidden', backgroundColor: '#1D1611', alignItems: 'center', justifyContent: 'center' },
  ask: { position: 'absolute', left: space['2xl'], right: space['2xl'], alignItems: 'center', gap: space.md },
  frame: { width: FRAME.width, height: FRAME.height },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: LIGHT },
  tl: { left: 0, top: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 14 },
  tr: { right: 0, top: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 14 },
  bl: { left: 0, bottom: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 14 },
  br: { right: 0, bottom: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 14 },
  line: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: SAGE,
    shadowColor: SAGE,
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  status: {
    position: 'absolute',
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.full,
    backgroundColor: 'rgba(10,13,12,0.72)',
  },
  bottom: { alignItems: 'center', paddingTop: space.lg },
}));
