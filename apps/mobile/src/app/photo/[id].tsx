import { REPORT_REASONS, REPORT_REASON_LABEL, type EventDetail, type Page, type Photo } from '@eventshare/shared';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { Directory, File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Check, Download, Eye, EyeOff, Flag, Heart, Lock, Trash2, UserX, X } from 'lucide-react-native';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toast } from '@/components/toast';
import { initialsOf, Text } from '@/components/ui';
import { icon, radius, space } from '@/constants/theme';
import { stampText } from '@/features/events/identity';
import { ROLE_LABEL } from '@/features/events/roles';
import { VoicePlayer } from '@/features/capture/voice-player';
import { FilteredImage } from '@/features/gallery/photo-filters';
import { dateAsSavedNow } from '@/features/gallery/saved-date';
import { stableSource } from '@/features/gallery/stable-image';
import { SaveSheet } from '@/features/gallery/save-sheet';
import { usePreferences } from '@/store/preferences';
import {
  getDownloadUrl,
  keys,
  useApprovePhoto,
  useDeletePhoto,
  useEvent,
  useLikePhoto,
  useMe,
  useReportPhoto,
  useSetBlocked,
  useSetPhotoVisibility,
} from '@/services/api/hooks';
import { defaultTheme, makeStyles, ThemeProvider, useCurrentEventTheme } from '@/theme';
import { timeAgo } from '@/utils/format';

type Action = { icon: typeof X; label: string; onPress: () => void; busy?: boolean; filled?: boolean };

function ActionButton({ icon: Icon, label, onPress, busy, filled }: Action) {
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={busy} style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}>
      {busy ? <ActivityIndicator color={LIGHT} /> : <Icon size={icon.md} color={LIGHT} fill={filled ? LIGHT : 'none'} strokeWidth={icon.stroke} />}
      <Text variant="caption" style={styles.light}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The photo, wherever it was opened from (album, gallery, a filter, the home strip). Follows the
 * cache, so a like (or approval) shows here at once.
 */
function useCachedPhoto(eventId: string, id: string) {
  const qc = useQueryClient();
  const find = useCallback(() => {
    for (const [, data] of qc.getQueriesData<InfiniteData<Page<Photo>>>({ queryKey: keys.photos(eventId) })) {
      const found = data?.pages.flatMap((p) => p.items).find((p) => p.id === id);
      if (found) return found;
    }
    return null;
  }, [qc, eventId, id]);
  const subscribe = useCallback((onChange: () => void) => qc.getQueryCache().subscribe(onChange), [qc]);
  return useSyncExternalStore(subscribe, find);
}

function PhotoViewer() {
  const styles = useStyles();
  const { id, eventId } = useLocalSearchParams<{ id: string; eventId: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const me = useMe();
  const event = useEvent(eventId);
  const del = useDeletePhoto(eventId);
  const visibility = useSetPhotoVisibility(eventId);
  const approve = useApprovePhoto(eventId);
  const like = useLikePhoto(eventId);
  const report = useReportPhoto(eventId);
  const block = useSetBlocked();
  const [saving, setSaving] = useState(false);
  const [savingMedia, setSavingMedia] = useState(false);
  const prefs = usePreferences();
  const [area, setArea] = useState({ width: 0, height: 0 });
  // The picture's real shape, once it loads (older photos have no stored size).
  const [loadedRatio, setLoadedRatio] = useState<number | null>(null);
  const onPhotoLoad = useCallback((w: number, h: number) => w && h && setLoadedRatio(w / h), []);
  const photo = useCachedPhoto(eventId, id);

  /**
   * Leave once. After Delete, Report, Block and the like, the refetch drops the photo from the
   * cache while the viewer is still closing; going back again then would also close the screen
   * underneath. `shouldLeave` only ever turns true once, so the effect goes back exactly once.
   */
  const [closing, setClosing] = useState(false);
  const close = () => setClosing(true);
  // Also leave when opened for a photo that's gone (deleted elsewhere, or no longer yours to see).
  const shouldLeave = closing || !photo;
  useEffect(() => {
    if (shouldLeave) router.back();
  }, [shouldLeave]);

  if (!photo) return null;

  const ev: EventDetail | undefined = event.data;
  const isHost = ev?.role === 'host';
  const isMine = photo.uploader.id === me.data?.id;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: keys.photos(eventId) });
    void qc.invalidateQueries({ queryKey: keys.event(eventId) });
  };

  function remove(done: string) {
    del.mutate(photo!.id, {
      onSuccess: () => {
        refresh();
        close();
        toast(done);
      },
      onError: (e) => Alert.alert("Couldn't delete", e.message),
    });
  }

  function confirmDelete() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Delete this photo?', 'It will be removed from the album for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(isHost ? 'Deleted for everyone' : 'Removed from the album') },
    ]);
  }

  const kindWord = photo.kind === 'video' ? 'video' : photo.kind === 'voice' ? 'voice note' : 'photo';
  const firstName = photo.uploader.name.split(' ')[0] || photo.uploader.name;

  /** Report as objectionable (App Store rule 1.2): pick a reason; it's gone for you at once. */
  function confirmReport() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(`Report this ${kindWord}?`, `It disappears for you straight away, goes back to the hosts for review, and the Klickers team checks it within 24 hours. ${firstName} isn't told who reported it.`, [
      ...REPORT_REASONS.map((reason) => ({
        text: REPORT_REASON_LABEL[reason],
        onPress: () =>
          report.mutate(
            { photoId: photo!.id, reason },
            {
              onSuccess: () => {
                close();
                toast('Reported. Thanks for telling us');
              },
              onError: (e) => Alert.alert("Couldn't report", e.message),
            },
          ),
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  /** Block the person who added it: nothing they add shows for you again, in any event. */
  function confirmBlock() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(`Block ${photo!.uploader.name}?`, `You won't see anything ${firstName} adds, in any event. They aren't told. You can unblock them from your profile.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () =>
          block.mutate(
            { userId: photo!.uploader.id, blocked: true },
            {
              onSuccess: () => {
                close();
                toast(`${firstName} is blocked`);
              },
              onError: (e) => Alert.alert("Couldn't block", e.message),
            },
          ),
      },
    ]);
  }

  const actions: Action[] = [];
  if (isHost && photo.pendingReview) {
    actions.push({
      icon: Check,
      label: 'Approve',
      busy: approve.isPending,
      onPress: () =>
        approve.mutate(photo.id, {
          onSuccess: () => {
            close();
            toast('Approved. It’s live for guests');
          },
          onError: (e) => Alert.alert("Couldn't approve", e.message),
        }),
    });
    actions.push({ icon: X, label: 'Decline', busy: del.isPending, onPress: () => remove('Declined and removed') });
  } else {
    actions.push({
      icon: Heart,
      label: photo.likedByMe ? 'Liked' : 'Like',
      filled: photo.likedByMe,
      onPress: () => {
        void Haptics.selectionAsync();
        like.mutate({ photoId: photo.id, liked: !photo.likedByMe });
      },
    });
    const canSave = isHost || isMine || ev?.allowDownloads !== false;
    actions.push(
      canSave
        ? {
            icon: Download,
            label: 'Save',
            busy: savingMedia,
            onPress: () => {
              // Photos get the save choices (original, with the look, framed); videos and voice save as they are.
              if (photo.kind === 'photo') return setSaving(true);
              setSavingMedia(true);
              saveMedia(photo)
                .catch((e: unknown) => Alert.alert("Couldn't save", e instanceof Error ? e.message : 'Please try again.'))
                .finally(() => setSavingMedia(false));
            },
          }
        : { icon: Lock, label: 'Saving off', onPress: () => toast('The hosts turned off downloads') },
    );
    if (isHost) {
      const hidden = photo.visibility === 'hidden';
      actions.push({
        icon: hidden ? Eye : EyeOff,
        label: hidden ? 'Unhide' : 'Hide',
        busy: visibility.isPending,
        onPress: () =>
          visibility.mutate(
            { photoId: photo.id, visibility: hidden ? 'visible' : 'hidden' },
            {
              onSuccess: () => {
                close();
                toast(hidden ? 'Visible to guests again' : 'Hidden from guests');
              },
              onError: (e) => Alert.alert(hidden ? "Couldn't unhide" : "Couldn't hide", e.message),
            },
          ),
      });
    }
    if (isMine || isHost) actions.push({ icon: Trash2, label: 'Delete', busy: del.isPending, onPress: confirmDelete });
    // Hosts moderate with Hide and Delete; everyone else can report a photo and block its owner.
    if (!isMine && !isHost) {
      actions.push({ icon: Flag, label: 'Report', busy: report.isPending, onPress: confirmReport });
      actions.push({ icon: UserX, label: 'Block', busy: block.isPending, onPress: confirmBlock });
    }
  }

  const status = [timeAgo(photo.createdAt), photo.pendingReview && 'Waiting for review', photo.visibility === 'hidden' && 'Hidden from guests']
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={styles.close}>
          <X size={20} color={LIGHT} strokeWidth={icon.stroke} />
        </Pressable>
        {photo.prompt && (
          <View style={styles.promptPill}>
            <Text variant="caption" style={styles.light}>
              Shot list · {photo.prompt}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.photoArea} onLayout={(e) => setArea(e.nativeEvent.layout)}>
        {photo.kind === 'video' && photo.url ? (
          <VideoPlayer uri={photo.url} />
        ) : photo.kind === 'voice' && photo.url ? (
          <VoicePlayer uri={photo.url} durationMs={photo.durationMs ?? 0} style={StyleSheet.absoluteFill} />
        ) : ev && ev.filter !== 'natural' ? (
          <FilteredImage uri={photo.previewUrl ?? photo.url} filter={ev.filter} fit="contain" style={StyleSheet.absoluteFill} onLoad={onPhotoLoad} />
        ) : (
          <Image
            source={photo.url ? stableSource(photo.previewUrl ?? photo.url) : undefined}
            placeholder={photo.thumbUrl ? stableSource(photo.thumbUrl) : undefined}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={200}
            onLoad={(e) => onPhotoLoad(e.source.width, e.source.height)}
            accessibilityLabel={`Photo by ${photo.uploader.name}`}
          />
        )}
        {photo.kind === 'photo' && ev?.dateStamp && prefs.dateStamp && area.width > 0 && (
          <Text style={[styles.stamp, stampSpot(area, loadedRatio ?? (photo.width && photo.height ? photo.width / photo.height : 4 / 5))]}>{stampText(ev, photo.takenAt ?? photo.createdAt)}</Text>
        )}
      </View>

      <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
        <View style={styles.meta}>
          <View style={styles.initials}>
            <Text style={styles.initialsText}>{initialsOf(photo.uploader.name)}</Text>
          </View>
          <View style={styles.flex}>
            <View style={styles.row}>
              <Text variant="bodyStrong" style={styles.light}>
                {isMine ? 'You' : photo.uploader.name}
              </Text>
              <View style={styles.role}>
                <Text style={styles.roleText}>{ROLE_LABEL[photo.uploader.role]}</Text>
              </View>
            </View>
            <Text variant="caption" style={styles.dim}>
              {status}
            </Text>
          </View>
          <View style={styles.row} accessibilityLabel={`${photo.likeCount} likes`}>
            <Heart size={14} color={DIM} />
            <Text variant="label" style={styles.dim}>
              {photo.likeCount}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          {actions.map((a) => (
            <ActionButton key={a.label} {...a} />
          ))}
        </View>
      </View>
      {saving && photo.kind === 'photo' && <SaveSheet photo={photo} event={ev} onClose={() => setSaving(false)} />}
    </View>
  );
}

/** A video, played as filmed with the phone's own controls (the event's look is for photos). */
function VideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => p.play());
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls accessibilityLabel="Video" />;
}

/**
 * Saves a video's untouched original to Photos; a voice note (Photos can't hold audio) goes to
 * the share sheet, for Files, WhatsApp and the like.
 */
async function saveMedia(photo: Photo) {
  const { url } = await getDownloadUrl(photo.id);
  const dir = new Directory(Paths.cache, 'downloads');
  dir.create({ intermediates: true, idempotent: true });
  const file = await File.downloadFileAsync(url, dir, { idempotent: true });
  // The copy in the cache goes whatever happens: shared, saved, refused or failed.
  try {
    if (photo.kind === 'voice') {
      await Share.share({ url: file.uri });
      return;
    }
    const perm = await requestPermissionsAsync(true);
    if (!perm.granted) throw new Error('Allow Klickers to add to your Photos in Settings.');
    // Dated as saved now, so it's at the top of the gallery, not back on the event day.
    await dateAsSavedNow(file.uri, 'video');
    await Asset.create(file.uri);
    toast('Video saved to your Photos');
  } finally {
    if (file.exists) file.delete();
  }
}

/** The photo is shown whole (contain), so put the stamp in the picture's own bottom-right corner. */
function stampSpot(area: { width: number; height: number }, ratio: number) {
  const shown = area.width / area.height > ratio ? { width: area.height * ratio, height: area.height } : { width: area.width, height: area.width / ratio };
  return { right: (area.width - shown.width) / 2 + space.md, bottom: (area.height - shown.height) / 2 + space.sm + 2 };
}

// The viewer is always dark: it's about the photo.
const LIGHT = '#F4F2DF';
const DIM = 'rgba(244,242,223,0.7)';

const useStyles = makeStyles(({ fonts }) => ({
  screen: { flex: 1, backgroundColor: '#0E1311' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, paddingHorizontal: 14, paddingBottom: space.sm },
  close: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  promptPill: { paddingHorizontal: space.sm + 2, paddingVertical: 6, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.1)' },
  photoArea: { flex: 1 },
  stamp: {
    position: 'absolute',
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.92)',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowRadius: 4,
  },
  bar: { paddingHorizontal: 18, paddingTop: 14, gap: 14, backgroundColor: 'rgba(23,43,35,0.92)' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  flex: { flex: 1, minWidth: 0, gap: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  initials: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  // People's initials are in eventShare's serif, whatever the event's name font.
  initialsText: { fontFamily: defaultTheme.fonts.serif, fontSize: 13, color: LIGHT },
  role: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.12)' },
  roleText: { fontFamily: fonts.sansSemiBold, fontSize: 10, lineHeight: 15, letterSpacing: 0.6, textTransform: 'uppercase', color: LIGHT },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: space.xs, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.08)' },
  light: { color: LIGHT },
  dim: { color: DIM },
}));

/** Drawn in the open event's theme (the sheets it opens follow it). */
export default function PhotoViewerScreen() {
  return (
    <ThemeProvider theme={useCurrentEventTheme()}>
      <PhotoViewer />
    </ThemeProvider>
  );
}
