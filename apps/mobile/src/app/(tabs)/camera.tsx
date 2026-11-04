import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as LegacyLibrary from 'expo-media-library/legacy';
import { requestPermissionsAsync as requestLibraryAccess } from 'expo-media-library';
import { useIsFocused } from 'expo-router';
import { ArrowUpRight, Camera, CloudUpload, Images, SwitchCamera, Upload, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { Button, Header, IconButton, Text } from '@/components/ui';
import { icon, radius, screenPadding, space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';
import { NoEventYet } from '@/features/events/no-event';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { enqueuePhoto } from '@/features/uploads/queue';
import { useUploadQueue } from '@/features/uploads/use-upload-queue';
import { plural } from '@/utils/format';

const TYPE_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', heic: 'image/heic', heif: 'image/heif', png: 'image/png', webp: 'image/webp' };

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

type Shot = { uri: string; width: number; height: number; takenAt: string };

/** Drop a shot the person chose not to keep. It never left the phone. */
function discardFile(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // The camera's cache gets cleared by the OS anyway.
  }
}

export default function CameraScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { id, event } = useCurrentEvent();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState<Shot | null>(null);
  const camera = useRef<CameraView>(null);
  const queue = useUploadQueue(id);
  const flash = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() }));

  const granted = permission?.granted ?? false;
  // Photos still on this phone count too, until the server has counted them itself.
  const limit = event?.photoLimit ?? 0;
  const left = event ? Math.max(0, event.photoLimit - event.photosUsed - queue.unreserved) : 0;
  const outOfShots = Boolean(event) && left === 0;

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
    if (!camera.current || !id || busy || shot || outOfShots) return;
    setBusy(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    flash.set(withSequence(withTiming(0.85, { duration: 40 }), withTiming(0, { duration: 260 })));
    try {
      // quality 1 = the camera's full-quality capture; we never recompress it after this.
      const pic = await camera.current.takePictureAsync({ quality: 1, exif: true });
      // Nothing is counted or uploaded until they choose Upload on the preview.
      setShot({ uri: pic.uri, width: pic.width, height: pic.height, takenAt: new Date().toISOString() });
    } catch (err) {
      Alert.alert("Couldn't take the photo", err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function keepShot() {
    if (!shot || !id) return;
    setBusy(true);
    try {
      await enqueuePhoto({ eventId: id, uri: shot.uri, contentType: 'image/jpeg', width: shot.width, height: shot.height, takenAt: shot.takenAt });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShot(null);
    } catch (err) {
      Alert.alert("Couldn't save the photo", err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function dropShot() {
    if (!shot) return;
    discardFile(shot.uri);
    setShot(null);
  }

  async function pickFromLibrary() {
    if (!id || !event) return;
    if (outOfShots) {
      Alert.alert('No photos left', `You've used all ${limit} of your photos for this event.`);
      return;
    }
    const access = await requestLibraryAccess(false, ['photo']);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.min(50, left),
      quality: 1,
      // Ask iOS for the file as stored (e.g. HEIC) instead of a converted copy.
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    });
    if (res.canceled) return;
    // Some Android pickers ignore selectionLimit.
    const picked = res.assets.slice(0, left);
    if (picked.length < res.assets.length) {
      Alert.alert(`Adding ${plural(picked.length, 'photo')}`, `You had ${left} left for this event, so the rest weren't added.`);
    }
    for (const asset of picked) {
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

  if (!id) return <NoEventYet title="Your camera" />;

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
          {event && (
            <View style={styles.counterBox} accessibilityLabel={`${left} of ${limit} photos left`}>
              <Text style={styles.counter}>{left}</Text>
              <Text variant="caption" color="muted">
                left
              </Text>
            </View>
          )}
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
        </View>

        <View style={styles.shutterRow}>
          <IconButton icon={Images} accessibilityLabel="Add from your photos" onPress={pickFromLibrary} size={48} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            disabled={!granted || !ready || busy || outOfShots}
            onPress={shoot}
            style={[styles.shutter, (!granted || !ready || outOfShots) && { opacity: 0.45 }]}>
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
          {outOfShots ? (
            <Text variant="caption" color="muted" align="center">
              You’ve used all {limit} of your photos for this event.
            </Text>
          ) : queue.pending > 0 ? (
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

      <Modal visible={Boolean(shot)} animationType="fade" statusBarTranslucent onRequestClose={dropShot}>
        <SafeAreaView style={styles.preview}>
          {shot && <Image source={{ uri: shot.uri }} style={styles.previewImage} contentFit="contain" accessibilityLabel="The photo you just took" />}
          <Text variant="caption" align="center" style={styles.previewHint}>
            Uploading uses 1 of your {left} photos left. Discarded photos don’t count.
          </Text>
          <View style={styles.previewActions}>
            <View style={styles.flex}>
              <Button label="Discard" variant="secondary" leadingIcon={X} fullWidth disabled={busy} onPress={dropShot} />
            </View>
            <View style={styles.flex}>
              <Button label="Upload" leadingIcon={Upload} fullWidth loading={busy} onPress={keepShot} />
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles(({ colors, fonts }) => ({
  screen: { flex: 1, backgroundColor: colors.sage },
  body: { padding: screenPadding, paddingBottom: space['3xl'] },
  caption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.lg, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flexShrink: { flexShrink: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  counterBox: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  counter: { fontFamily: fonts.mono, fontSize: 20, color: colors.primary },
  flex: { flex: 1 },
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
  preview: { flex: 1, backgroundColor: colors.viewfinder, padding: screenPadding, gap: space.lg },
  previewImage: { flex: 1, borderRadius: radius.lg },
  previewHint: { color: colors.viewfinderText, opacity: 0.75 },
  previewActions: { flexDirection: 'row', gap: space.md },
}));
