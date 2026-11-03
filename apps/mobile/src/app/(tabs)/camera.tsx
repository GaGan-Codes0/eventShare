import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as LegacyLibrary from 'expo-media-library/legacy';
import { requestPermissionsAsync as requestLibraryAccess } from 'expo-media-library';
import { useIsFocused } from 'expo-router';
import { ArrowUpRight, Camera, CloudUpload, Images, SwitchCamera } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { Header, IconButton, Text } from '@/components/ui';
import { colors, fonts, icon, radius, screenPadding, space } from '@/constants/theme';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { enqueuePhoto } from '@/features/uploads/queue';
import { useUploadQueue } from '@/features/uploads/use-upload-queue';
import { plural } from '@/utils/format';

const TYPE_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', heic: 'image/heic', heif: 'image/heif', png: 'image/png', webp: 'image/webp' };

/**
 * The picker can hand back a re-encoded copy (iOS does this for JPEGs). When we're allowed to read
 * the library, use the file exactly as stored in Photos instead, so the original is untouched.
 */
/**
 * The picker hands back a re-encoded copy for some photos (iOS does this for JPEGs). When we're
 * allowed to read the library, upload the file exactly as stored in Photos instead.
 * Uses the legacy API: the new `Asset.getUri()` can't find picker-selected assets in SDK 58.
 */
async function originalFile(asset: ImagePicker.ImagePickerAsset, canReadLibrary: boolean) {
  if (canReadLibrary && asset.assetId) {
    try {
      const info = await LegacyLibrary.getAssetInfoAsync(asset.assetId, { shouldDownloadFromNetwork: true });
      const ext = info.filename.split('.').pop()?.toLowerCase() ?? '';
      if (info.localUri && TYPE_BY_EXT[ext]) return { uri: info.localUri, contentType: TYPE_BY_EXT[ext] };
    } catch {
      // Fall back to the picker's copy below.
    }
  }
  return { uri: asset.uri, contentType: asset.mimeType };
}

export default function CameraScreen() {
  const { id, event } = useCurrentEvent();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [taken, setTaken] = useState(0);
  const camera = useRef<CameraView>(null);
  const queue = useUploadQueue(id);
  const flash = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() }));

  const granted = permission?.granted ?? false;

  async function enableCamera() {
    const res = await requestPermission();
    if (!res.granted && !res.canAskAgain) {
      Alert.alert('Camera is off', 'Allow camera access for eventShare in Settings to take photos.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ]);
    }
  }

  async function shoot() {
    if (!camera.current || !id || busy) return;
    setBusy(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    flash.set(withSequence(withTiming(0.85, { duration: 40 }), withTiming(0, { duration: 260 })));
    try {
      // quality 1 = the camera's full-quality capture; we never recompress it after this.
      const pic = await camera.current.takePictureAsync({ quality: 1, exif: true });
      await enqueuePhoto({
        eventId: id,
        uri: pic.uri,
        contentType: 'image/jpeg',
        width: pic.width,
        height: pic.height,
        takenAt: new Date().toISOString(),
      });
      setTaken((n) => n + 1);
    } catch (err) {
      Alert.alert("Couldn't take the photo", err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function pickFromLibrary() {
    if (!id) return;
    const access = await requestLibraryAccess(false, ['photo']);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 50,
      quality: 1,
      // Ask iOS for the file as stored (e.g. HEIC) instead of a converted copy.
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    });
    if (res.canceled) return;
    for (const asset of res.assets) {
      const original = await originalFile(asset, access.granted);
      await enqueuePhoto({
        eventId: id,
        uri: original.uri,
        contentType: original.contentType,
        width: asset.width,
        height: asset.height,
      });
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <View style={styles.screen}>
      <Header title="Your camera" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.caption}>
          <View style={styles.row}>
            <View style={styles.liveDot} />
            <Text variant="eyebrow" numberOfLines={1} style={styles.flexShrink}>
              Shooting for {event?.name ?? 'your event'}
            </Text>
          </View>
          <Text style={styles.counter}>{String(taken).padStart(2, '0')}</Text>
        </View>

        <View style={styles.viewfinder}>
          {granted && focused ? (
            <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={facing} onCameraReady={() => setReady(true)} />
          ) : (
            <View style={styles.idle}>
              <View style={styles.lens}>
                <Camera size={24} color={colors.viewfinderAccent} strokeWidth={icon.stroke} />
              </View>
              <Text variant="h1" align="center" style={{ color: colors.viewfinderText }}>
                Be here.{'\n'}
                <Text variant="h1" emphasis color="viewfinderAccent">
                  Keep a little of it.
                </Text>
              </Text>
              {!granted && (
                <Pressable accessibilityRole="button" onPress={enableCamera} style={styles.enable}>
                  <Text variant="label" style={{ color: colors.viewfinderText }}>
                    Enable camera
                  </Text>
                  <ArrowUpRight size={16} color={colors.viewfinderText} />
                </Pressable>
              )}
            </View>
          )}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
          <View pointerEvents="none" style={[styles.corner, styles.tl]} />
          <View pointerEvents="none" style={[styles.corner, styles.tr]} />
          <View pointerEvents="none" style={[styles.corner, styles.bl]} />
          <View pointerEvents="none" style={[styles.corner, styles.br]} />
          <Text pointerEvents="none" style={styles.frameLabel}>
            EVENTSHARE · FULL QUALITY
          </Text>
        </View>

        <View style={styles.shutterRow}>
          <IconButton icon={Images} accessibilityLabel="Add from your photos" onPress={pickFromLibrary} size={48} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            disabled={!granted || !ready || busy}
            onPress={shoot}
            style={({ pressed }) => [styles.shutter, (!granted || !ready) && { opacity: 0.45 }]}>
            {({ pressed }) => <View style={[styles.shutterInner, pressed && styles.shutterPressed]} />}
          </Pressable>
          <IconButton
            icon={SwitchCamera}
            accessibilityLabel="Switch camera"
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            size={48}
          />
        </View>

        <View style={styles.footnote}>
          {queue.pending > 0 ? (
            <View style={styles.row}>
              <CloudUpload size={14} color={colors.notice} />
              <Text variant="caption" color="notice">
                {plural(queue.pending, 'photo')} uploading · safe on this phone until done
              </Text>
            </View>
          ) : (
            <Text variant="caption" color="muted">
              Every photo goes to the shared album, at full quality.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const CORNER = 16;
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sage },
  body: { padding: screenPadding, paddingBottom: space['3xl'] },
  caption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.lg, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flexShrink: { flexShrink: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  counter: { fontFamily: fonts.mono, fontSize: 20, color: colors.primary },
  viewfinder: {
    aspectRatio: 4 / 5,
    borderRadius: radius.xl + 6,
    borderWidth: 6,
    borderColor: colors.viewfinder,
    backgroundColor: colors.viewfinder,
    overflow: 'hidden',
  },
  idle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  lens: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(205,215,171,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(170,182,139,0.45)',
  },
  flash: { backgroundColor: colors.white },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: colors.viewfinderText, opacity: 0.4 },
  tl: { top: space.md, left: space.md, borderTopWidth: 1, borderLeftWidth: 1 },
  tr: { top: space.md, right: space.md, borderTopWidth: 1, borderRightWidth: 1 },
  bl: { bottom: space['3xl'], left: space.md, borderBottomWidth: 1, borderLeftWidth: 1 },
  br: { bottom: space['3xl'], right: space.md, borderBottomWidth: 1, borderRightWidth: 1 },
  frameLabel: {
    position: 'absolute',
    left: space.md,
    bottom: space.sm,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.viewfinderAccent,
  },
  shutterRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space['3xl'] + space.lg, marginTop: space['2xl'] },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 1.5,
    borderColor: colors.primary,
    padding: 5,
  },
  shutterInner: { flex: 1, borderRadius: 34, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong },
  shutterPressed: { transform: [{ scale: 0.94 }], backgroundColor: colors.sage },
  footnote: { alignItems: 'center', marginTop: space.xl },
});
