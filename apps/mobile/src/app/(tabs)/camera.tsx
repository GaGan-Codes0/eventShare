import { ALLOWED_PHOTO_TYPES } from '@eventshare/shared';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as LegacyLibrary from 'expo-media-library/legacy';
import { requestPermissionsAsync as requestLibraryAccess } from 'expo-media-library';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Aperture, ArrowUpRight, Camera, CloudUpload, Film, Frame, Images, List, SwitchCamera, Upload, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Alert, Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { toast } from '@/components/toast';
import { Button, Text } from '@/components/ui';
import { icon, radius, screenPadding, space } from '@/constants/theme';
import { defaultTheme, makeStyles } from '@/theme';
import { ViewfinderFrame } from '@/features/events/event-frame';
import { NoEventYet } from '@/features/events/no-event';
import { lockText } from '@/features/gallery/album-view';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { enqueuePhoto } from '@/features/uploads/queue';
import { useUploadQueue } from '@/features/uploads/use-upload-queue';
import { setPreference, usePreferences } from '@/store/preferences';
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

const UPLOADABLE = new Set<string>(ALLOWED_PHOTO_TYPES);

/**
 * RAW photos (DNG and the like) are huge and most phones can't show them, so the album takes
 * a full-resolution JPEG developed from them on this phone instead. Everything else is as is.
 */
async function uploadable(file: { uri: string; contentType?: string }) {
  if (file.contentType && UPLOADABLE.has(file.contentType)) return { uri: file.uri, contentType: file.contentType };
  const rendered = await ImageManipulator.manipulate(file.uri).renderAsync();
  const jpeg = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
  return { uri: jpeg.uri, contentType: 'image/jpeg' };
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
  const styles = useStyles();
  const { id, event } = useCurrentEvent();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState<Shot | null>(null);
  const camera = useRef<CameraView>(null);
  const prefs = usePreferences();
  const insets = useSafeAreaInsets();
  const queue = useUploadQueue(id);
  const flash = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() }));

  const granted = permission?.granted ?? false;
  // Photos still on this phone count too, until the server has counted them itself.
  const limit = event?.photoLimit ?? 0;
  // No limit for this person: Infinity keeps the arithmetic simple; it's shown as ∞.
  const left = !event ? 0 : event.photoLimit === null ? Infinity : Math.max(0, event.photoLimit - event.photosUsed - queue.unreserved);
  const leftLabel = Number.isFinite(left) ? String(left) : '∞';
  const outOfShots = Boolean(event) && left === 0;
  // Guests can be limited to the camera; photographers and the host never are.
  const rollAllowed = !event || event.allowLibraryUploads || event.role !== 'member';
  // A shot-list prompt this photo is for, from the event's Home.
  const prompt = useLocalSearchParams<{ prompt?: string }>().prompt || null;
  const clearPrompt = () => router.setParams({ prompt: undefined });

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
      await enqueuePhoto({
        eventId: id,
        uri: shot.uri,
        contentType: 'image/jpeg',
        width: shot.width,
        height: shot.height,
        takenAt: shot.takenAt,
        source: 'camera',
        prompt: prompt ?? undefined,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShot(null);
      if (prompt) {
        toast(`Ticked off the shot list: ${prompt}`);
        clearPrompt();
      } else if (left === 1) {
        toast('That was your last shot. Roll complete');
      }
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
    if (!rollAllowed) {
      toast('Camera-roll uploads are off for this event');
      return;
    }
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
      let original: { uri: string; contentType: string };
      try {
        original = await uploadable(await originalFile(asset, access.granted));
      } catch {
        Alert.alert("Couldn't add a photo", 'This phone couldn’t read one of the photos (it may be a RAW file). Try saving it as JPEG first.');
        continue;
      }
      await enqueuePhoto({
        eventId: id,
        uri: original.uri,
        contentType: original.contentType,
        width: asset.width,
        height: asset.height,
        source: 'library',
      });
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  if (!id) return <NoEventYet title="Your camera" />;

  const note =
    event?.role !== 'member'
      ? 'Your shots skip review and go live instantly'
      : event.requireReview
        ? 'The hosts review guest photos before they go live'
        : !event.albumOpen
          ? lockText(event)
          : 'Photos appear live for everyone';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {focused && <StatusBar style="light" />}
      <View style={styles.top}>
        <View style={styles.flex}>
          <Text variant="eyebrow" style={styles.topEyebrow}>
            Shooting for
          </Text>
          <Text variant="h3" numberOfLines={1} style={styles.light}>
            {event?.name ?? ''}
          </Text>
        </View>
        {event && (
          <View style={styles.pill} accessibilityLabel={Number.isFinite(left) ? `${left} of ${limit} photos left` : 'No photo limit'}>
            {event.role === 'photographer' && <Aperture size={13} color={LIGHT} />}
            <Text style={styles.pillText}>{Number.isFinite(left) ? `${leftLabel} LEFT` : 'NO LIMIT'}</Text>
          </View>
        )}
      </View>

      {prompt && (
        <View style={styles.promptBar}>
          <List size={15} color={LIGHT} />
          <Text variant="label" style={[styles.light, styles.flex]}>
            Shot list · {prompt}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not shooting for the shot list"
            hitSlop={8}
            onPress={clearPrompt}>
            <X size={14} color={LIGHT} />
          </Pressable>
        </View>
      )}

      <View style={styles.viewfinder}>
        {outOfShots ? (
          <View style={styles.idle}>
            <View style={styles.lens}>
              <Film size={25} color={SAGE} strokeWidth={icon.stroke} />
            </View>
            <Text style={styles.wrapTitle}>
              That’s a <Text style={[styles.wrapTitle, styles.wrapItalic]}>wrap.</Text>
            </Text>
            <Text variant="caption" align="center" style={styles.wrapText}>
              All {limit} shots on your roll are in the album. Thank you for shooting.
            </Text>
            <Button label="See the album" onPress={() => router.navigate('/(tabs)/album')} />
          </View>
        ) : granted && focused ? (
          <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={facing} onCameraReady={() => setReady(true)} />
        ) : (
          <View style={styles.idle}>
            <View style={styles.lens}>
              <Camera size={25} color={SAGE} strokeWidth={icon.stroke} />
            </View>
            <Text style={styles.wrapTitle} accessibilityRole="header">
              Be here.{'\n'}
              <Text style={[styles.wrapTitle, styles.wrapItalic]}>Keep a little of it.</Text>
            </Text>
            {!granted && (
              <Pressable accessibilityRole="button" onPress={enableCamera} style={styles.enable}>
                <Text variant="label" style={styles.light}>
                  Enable camera
                </Text>
                <ArrowUpRight size={16} color={LIGHT} />
              </Pressable>
            )}
          </View>
        )}
        {granted && focused && !outOfShots && prefs.viewfinderFrame && <ViewfinderFrame logoUrl={event?.logoUrl ?? null} />}
        {granted && !outOfShots && (
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Show the event frame on screen"
            accessibilityState={{ checked: prefs.viewfinderFrame }}
            hitSlop={8}
            onPress={() => setPreference('viewfinderFrame', !prefs.viewfinderFrame)}
            style={[styles.frameToggle, prefs.viewfinderFrame && styles.frameToggleOn]}>
            <Frame size={icon.sm} color={prefs.viewfinderFrame ? DARK : LIGHT} />
          </Pressable>
        )}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
      </View>

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={rollAllowed ? 'Add from your photos' : 'Camera-roll uploads are off'}
          onPress={pickFromLibrary}
          style={[styles.round, !rollAllowed && styles.roundOff]}>
          <Images size={22} color={rollAllowed ? LIGHT : 'rgba(244,242,223,0.35)'} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          disabled={!granted || !ready || busy || outOfShots}
          onPress={shoot}
          style={({ pressed }) => [styles.shutter, (!granted || !ready || outOfShots) && { opacity: 0.4 }, pressed && { transform: [{ scale: 0.94 }] }]}>
          <View style={styles.shutterInner} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch camera"
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          style={styles.round}>
          <SwitchCamera size={22} color={LIGHT} />
        </Pressable>
      </View>
      <View style={styles.footnote}>
        {queue.pending > 0 ? (
          <View style={styles.row}>
            <CloudUpload size={14} color={SAGE} />
            <Text variant="caption" style={styles.noteText}>
              {plural(queue.pending, 'photo')} uploading · safe on this phone until done
            </Text>
          </View>
        ) : (
          <Text variant="caption" align="center" style={styles.noteText}>
            {note}
          </Text>
        )}
      </View>

      <Modal visible={Boolean(shot)} animationType="fade" statusBarTranslucent onRequestClose={dropShot}>
        <SafeAreaView style={styles.preview}>
          {shot && <Image source={{ uri: shot.uri }} style={styles.previewImage} contentFit="contain" accessibilityLabel="The photo you just took" />}
          <Text variant="caption" align="center" style={styles.previewHint}>
            {Number.isFinite(left) ? `Uploading uses 1 of your ${left} photos left. ` : ''}Discarded photos don’t count.
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

// The camera is always dark, whatever the event's theme: it's about the picture, not the page.
const DARK = '#0B0F0D';
const LIGHT = '#F4F2DF';
const SAGE = '#CDD7AB';

const useStyles = makeStyles(({ colors, fonts }) => ({
  screen: { flex: 1, backgroundColor: DARK },
  top: { height: 54, paddingHorizontal: screenPadding - 4, flexDirection: 'row', alignItems: 'center', gap: space.md - 2 },
  topEyebrow: { color: 'rgba(244,242,223,0.6)', fontSize: 9.5, lineHeight: 13 },
  light: { color: LIGHT },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  pillText: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 14, letterSpacing: 0.7, color: LIGHT },
  promptBar: {
    marginHorizontal: 14,
    marginBottom: space.sm,
    paddingVertical: 7,
    paddingLeft: space.md,
    paddingRight: space.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.09)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  viewfinder: { flex: 1, marginHorizontal: 14, borderRadius: 24, overflow: 'hidden', backgroundColor: '#1A221E' },
  idle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space['2xl'], backgroundColor: '#304538' },
  lens: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: 'rgba(205,215,171,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // eventShare's own serif here, whatever the event's heading font (as in the design).
  wrapTitle: { fontFamily: defaultTheme.fonts.serif, fontSize: 30, lineHeight: 34, letterSpacing: -0.6, color: LIGHT, textAlign: 'center' },
  wrapItalic: { fontFamily: defaultTheme.fonts.serifItalic, color: SAGE },
  wrapText: { color: 'rgba(244,242,223,0.78)', maxWidth: 240 },
  enable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(205,215,171,0.45)',
  },
  flash: { backgroundColor: colors.white },
  frameToggle: {
    position: 'absolute',
    top: space.md,
    right: space.md,
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  frameToggleOn: { backgroundColor: LIGHT },
  controls: { paddingTop: space.lg, paddingHorizontal: 30, paddingBottom: space.sm + 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  roundOff: { backgroundColor: 'rgba(255,255,255,0.06)' },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 2, borderColor: colors.primary, padding: 5 },
  shutterInner: { flex: 1, borderRadius: 34, backgroundColor: LIGHT },
  footnote: { alignItems: 'center', paddingHorizontal: space['2xl'], paddingBottom: space.md },
  noteText: { color: 'rgba(244,242,223,0.6)' },
  preview: { flex: 1, backgroundColor: DARK, padding: screenPadding, gap: space.lg },
  previewImage: { flex: 1, borderRadius: radius.lg },
  previewHint: { color: LIGHT, opacity: 0.75 },
  previewActions: { flexDirection: 'row', gap: space.md },
}));
