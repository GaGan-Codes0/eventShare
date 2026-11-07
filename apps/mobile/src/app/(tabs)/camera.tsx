import { ALLOWED_PHOTO_TYPES, type MediaKind } from '@eventshare/shared';
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraType, type FlashMode, type FocusMode, type LensInfo } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as LegacyLibrary from 'expo-media-library/legacy';
import { requestPermissionsAsync as requestLibraryAccess } from 'expo-media-library';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Aperture, ArrowUpRight, Camera, CloudUpload, Film, Frame, Grid3x3, Images, Mic, SwitchCamera, Zap, ZapOff } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { toast } from '@/components/toast';
import { Button, Text } from '@/components/ui';
import { icon, radius, screenPadding, space } from '@/constants/theme';
import { defaultTheme, makeStyles } from '@/theme';
import { useVoiceNote, VoicePanel } from '@/features/capture/voice-recorder';
import { ViewfinderFrame } from '@/features/events/event-frame';
import { NoEventYet } from '@/features/events/no-event';
import { lockText } from '@/features/gallery/album-view';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { enqueuePhoto } from '@/features/uploads/queue';
import { useUploadQueue } from '@/features/uploads/use-upload-queue';
import { setPreference, usePreferences } from '@/store/preferences';
import { clock, plural } from '@/utils/format';

/** How long a photo just taken stays on the viewfinder before it fades. */
const SHOT_HOLD_MS = 2000;

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

type Shot = { uri: string; kind: MediaKind; contentType: string; width?: number; height?: number; durationMs?: number; takenAt: string };

const MODES: { value: MediaKind; label: string }[] = [
  { value: 'photo', label: 'Photo' },
  { value: 'video', label: 'Video' },
  { value: 'voice', label: 'Voice' },
];
/** Less than this left isn't worth starting a recording for. */
const MIN_CLIP_MS = 1000;

// iPhone lenses we offer as one-tap buttons, in order. Other lens types stay reachable by zooming.
const LENS_LABEL: Record<string, string> = {
  AVCaptureDeviceTypeBuiltInUltraWideCamera: '0.5×',
  AVCaptureDeviceTypeBuiltInWideAngleCamera: '1×',
  AVCaptureDeviceTypeBuiltInTelephotoCamera: 'Tele',
};
const WIDE = 'AVCaptureDeviceTypeBuiltInWideAngleCamera';
const NEXT_FLASH: Record<FlashMode, FlashMode> = { off: 'auto', auto: 'on', on: 'off', screen: 'off' };
const FLASH_LABEL: Record<FlashMode, string> = { off: 'Flash off', auto: 'Flash auto', on: 'Flash on', screen: 'Flash on' };
/** How much a full pinch (about the width of the screen) zooms, as a share of the phone's maximum. */
const PINCH_ZOOM = 0.5 / 300;

const dist = (t: GestureResponderEvent['nativeEvent']['touches']) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);

export default function CameraScreen() {
  const styles = useStyles();
  const { id, event } = useCurrentEvent();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<MediaKind>('photo');
  // Video recording: when it started, and a clock that ticks while it runs.
  const [recStart, setRecStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [mic, requestMic] = useMicrophonePermissions();
  const voice = useVoiceNote();
  const stoppingVoice = useRef(false);
  const wasRecordingVoice = useRef(false);
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [zoom, setZoom] = useState(0);
  const [lenses, setLenses] = useState<LensInfo[]>([]);
  const [lens, setLens] = useState(WIDE);
  const [autofocus, setAutofocus] = useState<FocusMode>('off');
  const [focusAt, setFocusAt] = useState<{ x: number; y: number } | null>(null);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const tap = useRef<{ x: number; y: number; at: number } | null>(null);
  const focusTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const camera = useRef<CameraView>(null);
  const prefs = usePreferences();
  const insets = useSafeAreaInsets();
  const queue = useUploadQueue(id);
  const flash = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() }));
  // The shot just taken stays on screen for 2 seconds, then fades as it uploads.
  const [justTaken, setJustTaken] = useState<string | null>(null);
  const shown = useSharedValue(0);
  const shownStyle = useAnimatedStyle(() => ({ opacity: shown.get() }));
  function showShot(uri: string) {
    setJustTaken(uri);
    shown.set(
      withSequence(
        withTiming(1, { duration: 120 }),
        withDelay(
          SHOT_HOLD_MS,
          withTiming(0, { duration: 450 }, (done) => {
            if (done) runOnJS(setJustTaken)(null);
          }),
        ),
      ),
    );
  }

  const granted = permission?.granted ?? false;
  // Photos still on this phone count too, until the server has counted them itself.
  const limit = event?.photoLimit ?? 0;
  // No limit for this person: Infinity keeps the arithmetic simple; it's shown as ∞.
  const left = !event ? 0 : event.photoLimit === null ? Infinity : Math.max(0, event.photoLimit - event.photosUsed - queue.unreserved);
  const leftLabel = Number.isFinite(left) ? String(left) : '∞';
  const outOfShots = Boolean(event) && left === 0;
  // Video and voice time left, counting recordings still on this phone.
  const videoLeft = event ? Math.max(0, event.videoLimitMs - event.videoMsUsed - queue.unreservedVideoMs) : 0;
  const voiceLeft = event ? Math.max(0, event.voiceLimitMs - event.voiceMsUsed - queue.unreservedVoiceMs) : 0;
  const recording = recStart !== null || voice.recording;
  // "That's a wrap" for whichever allowance this mode uses; the other modes may still have some.
  const out = Boolean(event) && (mode === 'photo' ? outOfShots : (mode === 'video' ? videoLeft : voiceLeft) < MIN_CLIP_MS);

  useEffect(() => {
    if (recStart === null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [recStart]);

  // Guests can be limited to the camera; photographers and the host never are.
  const rollAllowed = !event || event.allowLibraryUploads || event.role !== 'member';

  async function enableCamera() {
    const res = await requestPermission();
    if (!res.granted && !res.canAskAgain) {
      Alert.alert('Camera is off', 'Allow camera access for eventShare in Settings to take photos.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ]);
    }
  }

  /** Straight into the upload queue as soon as it's taken, like a camera-roll pick: no preview step. */
  async function keep(shot: Shot) {
    if (!id) return;
    setBusy(true);
    try {
      await enqueuePhoto({
        eventId: id,
        uri: shot.uri,
        kind: shot.kind,
        durationMs: shot.durationMs,
        contentType: shot.contentType,
        width: shot.width,
        height: shot.height,
        takenAt: shot.takenAt,
        source: 'camera',
        // A fresh recording is ours to take: a long video is never copied.
        move: shot.kind !== 'photo',
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (shot.kind === 'photo' && left === 1) {
        toast('That was your last shot. Roll complete');
      }
    } catch (err) {
      Alert.alert("Couldn't save the photo", err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  /** The shutter: a photo, start / stop a video, or start / stop a voice note. */
  function press() {
    if (mode === 'video') return void toggleVideo();
    if (mode === 'voice') return void toggleVoice();
    void shoot();
  }

  async function toggleVideo() {
    if (!camera.current || !id) return;
    if (recStart !== null) return camera.current.stopRecording();
    if (videoLeft < MIN_CLIP_MS) return toast('No video time left for this event');
    const micOk = mic?.granted || (await requestMic()).granted;
    if (!micOk) {
      Alert.alert('Microphone is off', 'Allow microphone access for eventShare in Settings to record video with sound.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ]);
      return;
    }
    const started = Date.now();
    setRecStart(started);
    setNow(started);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // Stops by itself when their video time runs out. Recorded at the camera's full quality.
      const res = await camera.current.recordAsync({ maxDuration: Math.floor(videoLeft / 1000) });
      const durationMs = Math.min(videoLeft, Date.now() - started);
      if (res?.uri && durationMs >= 500) {
        const contentType = res.uri.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
        void keep({ uri: res.uri, kind: 'video', contentType, durationMs, takenAt: new Date(started).toISOString() });
      }
    } catch (err) {
      Alert.alert("Couldn't record the video", err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setRecStart(null);
    }
  }

  async function toggleVoice() {
    if (!id) return;
    if (voice.recording) return finishVoice();
    if (voiceLeft < MIN_CLIP_MS) return toast('No voice-note time left for this event');
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await voice.start(voiceLeft);
    } catch (err) {
      Alert.alert("Couldn't record", err instanceof Error ? err.message : 'Please try again.');
    }
  }

  async function finishVoice() {
    stoppingVoice.current = true;
    try {
      const note = await voice.stop();
      if (note && note.durationMs >= 500) {
        void keep({ uri: note.uri, kind: 'voice', contentType: 'audio/mp4', durationMs: Math.min(note.durationMs, voiceLeft), takenAt: new Date().toISOString() });
      }
    } catch (err) {
      Alert.alert("Couldn't save the voice note", err instanceof Error ? err.message : 'Please try again.');
    } finally {
      stoppingVoice.current = false;
    }
  }

  // A voice note that stopped by itself (its time ran out) is ready to preview, like a tapped stop.
  useEffect(() => {
    if (wasRecordingVoice.current && !voice.recording && !stoppingVoice.current) void finishVoice();
    wasRecordingVoice.current = voice.recording;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.recording]);

  async function shoot() {
    if (!camera.current || !id || busy || outOfShots) return;
    setBusy(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    flash.set(withSequence(withTiming(0.85, { duration: 40 }), withTiming(0, { duration: 260 })));
    try {
      // quality 1 = the camera's full-quality capture; we never recompress it after this.
      const pic = await camera.current.takePictureAsync({ quality: 1, exif: true });
      showShot(pic.uri);
      void keep({ uri: pic.uri, kind: 'photo', contentType: 'image/jpeg', width: pic.width, height: pic.height, takenAt: new Date().toISOString() });
    } catch (err) {
      Alert.alert("Couldn't take the photo", err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }


  function flip() {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
    setZoom(0);
    setLens(WIDE);
  }

  function chooseLens(deviceType: string) {
    void Haptics.selectionAsync();
    setLens(deviceType);
    setZoom(0);
  }

  /** Two fingers zoom; a quick single tap refocuses, with a ring where it was tapped. */
  function onTouchStart(e: GestureResponderEvent) {
    const t = e.nativeEvent.touches;
    if (t.length === 2) {
      pinch.current = { dist: dist(t), zoom };
      tap.current = null;
    } else if (t.length === 1) {
      tap.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY, at: Date.now() };
    }
  }

  function onTouchMove(e: GestureResponderEvent) {
    const t = e.nativeEvent.touches;
    if (t.length === 2 && pinch.current) {
      const next = pinch.current.zoom + (dist(t) - pinch.current.dist) * PINCH_ZOOM;
      setZoom(Math.min(1, Math.max(0, next)));
    } else if (tap.current && Math.hypot(e.nativeEvent.locationX - tap.current.x, e.nativeEvent.locationY - tap.current.y) > 12) {
      tap.current = null;
    }
  }

  function onTouchEnd(e: GestureResponderEvent) {
    if (e.nativeEvent.touches.length === 0) pinch.current = null;
    const t = tap.current;
    tap.current = null;
    if (!t || pinch.current || Date.now() - t.at > 300) return;
    setFocusAt({ x: t.x, y: t.y });
    // Focus once on the new view, then go back to following the scene.
    setAutofocus('on');
    clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => {
      setAutofocus('off');
      setFocusAt(null);
    }, 1200);
  }

  async function pickFromLibrary() {
    if (!id || !event) return;
    if (!rollAllowed) {
      toast('Camera-roll uploads are off for this event');
      return;
    }
    const videosOk = videoLeft >= MIN_CLIP_MS;
    if (outOfShots && !videosOk) {
      Alert.alert('Nothing left to add', `You've used all ${limit} of your photos and your video time for this event.`);
      return;
    }
    const access = await requestLibraryAccess(false, ['photo', 'video']);
    const res = await ImagePicker.launchImageLibraryAsync({
      // Videos too, while they have video time left; photos while they have shots.
      mediaTypes: outOfShots ? ['videos'] : videosOk ? ['images', 'videos'] : ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 50,
      quality: 1,
      videoExportPreset: ImagePicker.VideoExportPreset.Passthrough,
      // Ask iOS for the file as stored (e.g. HEIC) instead of a converted copy.
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    });
    if (res.canceled) return;
    // Photos up to their shots left, videos up to their time left; the rest are left out.
    let videoTime = videoLeft;
    const videos = res.assets.filter((a) => a.type === 'video');
    const keptVideos = videos.filter((a) => {
      const ms = Math.round(a.duration ?? 0);
      if (ms < 500 || ms > videoTime) return false;
      videoTime -= ms;
      return true;
    });
    const photos = res.assets.filter((a) => a.type !== 'video');
    const picked = photos.slice(0, Number.isFinite(left) ? left : photos.length);
    const skipped = photos.length - picked.length + videos.length - keptVideos.length;
    if (skipped > 0) {
      Alert.alert(
        `${plural(skipped, 'item')} not added`,
        `You had ${Number.isFinite(left) ? plural(left, 'photo') : 'unlimited photos'} and ${clock(videoLeft)} of video time left, so the rest weren't added.`,
      );
    }
    for (const asset of keptVideos) {
      await enqueuePhoto({
        eventId: id,
        uri: asset.uri,
        kind: 'video',
        durationMs: Math.round(asset.duration ?? 0),
        contentType: asset.mimeType ?? (asset.uri.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4'),
        width: asset.width,
        height: asset.height,
        source: 'library',
      });
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

  // The live camera: Photo and Video modes, while there's something left to take.
  const live = granted && focused && !out && mode !== 'voice';
  const elapsed = recStart !== null ? Math.max(0, now - recStart) : 0;
  // iPhone only: the back lenses this phone has, as 0.5× / 1× / Tele buttons.
  const lensChips =
    Platform.OS === 'ios' && facing === 'back'
      ? Object.keys(LENS_LABEL)
          .map((t) => lenses.find((l) => l.deviceType === t))
          .filter((l): l is LensInfo => Boolean(l))
      : [];

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
          <View
            style={styles.pill}
            accessibilityLabel={
              mode === 'video'
                ? `${clock(videoLeft)} of video time left`
                : mode === 'voice'
                  ? `${clock(voiceLeft)} of voice-note time left`
                  : Number.isFinite(left)
                    ? `${left} of ${limit} photos left`
                    : 'No photo limit'
            }>
            {event.role === 'photographer' && <Aperture size={13} color={LIGHT} />}
            <Text style={styles.pillText}>
              {mode === 'video' ? `${clock(videoLeft)} LEFT` : mode === 'voice' ? `${clock(voiceLeft)} LEFT` : Number.isFinite(left) ? `${leftLabel} LEFT` : 'NO LIMIT'}
            </Text>
          </View>
        )}
      </View>


      <View style={styles.viewfinder}>
        {out ? (
          <View style={styles.idle}>
            <View style={styles.lens}>
              {mode === 'voice' ? <Mic size={25} color={SAGE} strokeWidth={icon.stroke} /> : <Film size={25} color={SAGE} strokeWidth={icon.stroke} />}
            </View>
            <Text style={styles.wrapTitle}>
              That’s a <Text style={[styles.wrapTitle, styles.wrapItalic]}>wrap.</Text>
            </Text>
            <Text variant="caption" align="center" style={styles.wrapText}>
              {mode === 'photo'
                ? `All ${limit} shots on your roll are in the album. Thank you for shooting.`
                : mode === 'video'
                  ? `You've used all ${clock(event?.videoLimitMs ?? 0)} of your video time. Thank you for filming.`
                  : `You've used your ${clock(event?.voiceLimitMs ?? 0)} of voice notes. Thank you for the kind words.`}
            </Text>
            <Button label="See the album" onPress={() => router.navigate('/(tabs)/album')} />
          </View>
        ) : mode === 'voice' ? (
          <VoicePanel recording={voice.recording} elapsedMs={voice.elapsedMs} leftMs={voiceLeft} />
        ) : granted && focused ? (
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            mode={mode === 'video' ? 'video' : 'picture'}
            facing={facing}
            flash={facing === 'front' && flashMode === 'on' ? 'screen' : flashMode}
            zoom={zoom}
            autofocus={autofocus}
            selectedLens={facing === 'back' ? lens : undefined}
            onAvailableLensesChanged={(e) => setLenses(e.lenses)}
            onCameraReady={() => setReady(true)}
          />
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
        {live && prefs.viewfinderFrame && <ViewfinderFrame logoUrl={event?.logoUrl ?? null} />}
        {live && prefs.cameraGrid && (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {[1, 2].map((i) => (
              <View key={`v${i}`} style={[styles.gridLine, { left: `${(i * 100) / 3}%`, top: 0, bottom: 0, width: StyleSheet.hairlineWidth }]} />
            ))}
            {[1, 2].map((i) => (
              <View key={`h${i}`} style={[styles.gridLine, { top: `${(i * 100) / 3}%`, left: 0, right: 0, height: StyleSheet.hairlineWidth }]} />
            ))}
          </View>
        )}
        {live && (
          <View style={StyleSheet.absoluteFill} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
            {focusAt && <View pointerEvents="none" style={[styles.focusRing, { left: focusAt.x - 32, top: focusAt.y - 32 }]} />}
          </View>
        )}
        {recStart !== null && (
          <View style={styles.recBadge} accessibilityLiveRegion="polite">
            <View style={styles.recDot} />
            <Text style={styles.recText}>
              {clock(elapsed)} / {clock(videoLeft)}
            </Text>
          </View>
        )}
        {granted && !outOfShots && (
          <View style={styles.tools}>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Show the event frame on screen"
              accessibilityState={{ checked: prefs.viewfinderFrame }}
              hitSlop={6}
              onPress={() => setPreference('viewfinderFrame', !prefs.viewfinderFrame)}
              style={[styles.tool, prefs.viewfinderFrame && styles.toolOn]}>
              <Frame size={icon.sm} color={prefs.viewfinderFrame ? DARK : LIGHT} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={FLASH_LABEL[flashMode]}
              accessibilityHint="Changes the flash: off, auto or on"
              hitSlop={6}
              onPress={() => {
                void Haptics.selectionAsync();
                setFlashMode((f) => NEXT_FLASH[f]);
              }}
              style={[styles.tool, flashMode === 'on' && styles.toolOn]}>
              {flashMode === 'off' ? <ZapOff size={icon.sm} color={LIGHT} /> : <Zap size={icon.sm} color={flashMode === 'on' ? DARK : LIGHT} />}
              {flashMode === 'auto' && <Text style={styles.toolBadge}>A</Text>}
            </Pressable>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Grid lines"
              accessibilityState={{ checked: prefs.cameraGrid }}
              hitSlop={6}
              onPress={() => setPreference('cameraGrid', !prefs.cameraGrid)}
              style={[styles.tool, prefs.cameraGrid && styles.toolOn]}>
              <Grid3x3 size={icon.sm} color={prefs.cameraGrid ? DARK : LIGHT} />
            </Pressable>
          </View>
        )}
        {live && (lensChips.length > 1 || zoom > 0.005) && (
          <View style={styles.zoomRow}>
            {lensChips.length > 1 ? (
              lensChips.map((l) => {
                const on = lens === l.deviceType;
                return (
                  <Pressable
                    key={l.deviceType}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={l.localizedName}
                    hitSlop={4}
                    onPress={() => chooseLens(l.deviceType)}
                    style={[styles.zoomChip, on && styles.zoomChipOn]}>
                    <Text style={[styles.zoomText, on && styles.zoomTextOn]}>{on && zoom > 0.005 ? 'Zoom' : LENS_LABEL[l.deviceType]}</Text>
                  </Pressable>
                );
              })
            ) : (
              <Pressable accessibilityRole="button" accessibilityLabel="Reset zoom" hitSlop={4} onPress={() => setZoom(0)} style={[styles.zoomChip, styles.zoomChipOn]}>
                <Text style={[styles.zoomText, styles.zoomTextOn]}>1×</Text>
              </Pressable>
            )}
          </View>
        )}
        {justTaken && (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, shownStyle]}>
            <Image source={{ uri: justTaken }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
            <View style={styles.uploadingTag}>
              <CloudUpload size={14} color={LIGHT} />
              <Text style={styles.uploadingText}>Uploading</Text>
            </View>
          </Animated.View>
        )}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
      </View>

      <View style={styles.modes} accessibilityRole="tablist">
        {MODES.map((m) => {
          const on = mode === m.value;
          return (
            <Pressable
              key={m.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: on, disabled: recording }}
              disabled={recording}
              hitSlop={8}
              onPress={() => {
                void Haptics.selectionAsync();
                setMode(m.value);
              }}>
              <Text style={[styles.modeText, on && styles.modeOn, recording && !on && { opacity: 0.35 }]}>{m.label.toUpperCase()}</Text>
            </Pressable>
          );
        })}
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
          accessibilityLabel={
            mode === 'photo' ? 'Take photo' : recording ? 'Stop recording' : mode === 'video' ? 'Record video' : 'Record a voice note'
          }
          disabled={busy || out || (mode !== 'voice' && (!granted || !ready))}
          onPress={press}
          style={({ pressed }) => [
            styles.shutter,
            (out || (mode !== 'voice' && (!granted || !ready))) && { opacity: 0.4 },
            pressed && { transform: [{ scale: 0.94 }] },
          ]}>
          {mode === 'photo' ? (
            <View style={styles.shutterInner} />
          ) : (
            <View style={styles.recWrap}>
              <View style={recording ? styles.recStop : styles.recStart} />
            </View>
          )}
        </Pressable>
        {mode === 'voice' ? (
          // Keeps the shutter centred.
          <View style={styles.roundSpacer} />
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Switch camera" disabled={recording} onPress={flip} style={styles.round}>
            <SwitchCamera size={22} color={LIGHT} />
          </Pressable>
        )}
      </View>
      <View style={styles.footnote}>
        {queue.pending > 0 ? (
          <View style={styles.row}>
            <CloudUpload size={14} color={SAGE} />
            <Text variant="caption" style={styles.noteText}>
              {queue.pending} uploading · safe on this phone until done
            </Text>
          </View>
        ) : (
          <Text variant="caption" align="center" style={styles.noteText}>
            {note}
          </Text>
        )}
      </View>

    </View>
  );
}

// The camera is always dark, whatever the event's theme: it's about the picture, not the page.
const DARK = '#0B0F0D';
const LIGHT = '#F4F2DF';
const SAGE = '#CDD7AB';
const REC = '#E5484D';

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
  uploadingTag: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(14,18,16,0.55)',
  },
  uploadingText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, lineHeight: 16, color: LIGHT },
  tools: { position: 'absolute', top: space.md, right: space.md, gap: space.sm },
  tool: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  toolOn: { backgroundColor: LIGHT },
  toolBadge: { position: 'absolute', right: 6, bottom: 4, fontFamily: fonts.mono, fontSize: 8, lineHeight: 9, color: LIGHT },
  gridLine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.45)' },
  focusRing: { position: 'absolute', width: 64, height: 64, borderRadius: 8, borderWidth: 1.5, borderColor: '#FFD60A' },
  zoomRow: { position: 'absolute', bottom: space.lg, alignSelf: 'center', flexDirection: 'row', gap: 4, padding: 3, borderRadius: radius.full, backgroundColor: 'rgba(0,0,0,0.35)' },
  zoomChip: { minWidth: 36, height: 30, paddingHorizontal: 6, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  zoomChipOn: { backgroundColor: 'rgba(0,0,0,0.5)' },
  zoomText: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 13, color: LIGHT },
  zoomTextOn: { color: '#FFD60A' },
  controls: { paddingTop: space.lg, paddingHorizontal: 30, paddingBottom: space.sm + 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  roundSpacer: { width: 50, height: 50 },
  roundOff: { backgroundColor: 'rgba(255,255,255,0.06)' },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 2, borderColor: colors.primary, padding: 5 },
  shutterInner: { flex: 1, borderRadius: 34, backgroundColor: LIGHT },
  recWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  recStart: { width: 58, height: 58, borderRadius: 29, backgroundColor: REC },
  recStop: { width: 28, height: 28, borderRadius: 7, backgroundColor: REC },
  recBadge: {
    position: 'absolute',
    top: space.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: REC },
  recText: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 16, color: '#FFFFFF' },
  modes: { flexDirection: 'row', justifyContent: 'center', gap: space['2xl'], paddingTop: space.md },
  modeText: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16, letterSpacing: 1.4, color: 'rgba(244,242,223,0.55)' },
  modeOn: { color: '#FFD60A' },
  footnote: { alignItems: 'center', paddingHorizontal: space['2xl'], paddingBottom: space.md },
  noteText: { color: 'rgba(244,242,223,0.6)' },
}));
