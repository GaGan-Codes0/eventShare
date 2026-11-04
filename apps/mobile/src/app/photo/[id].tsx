import type { Photo } from '@eventshare/shared';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Download, Eye, EyeOff, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { icon, radius, screenPadding, space } from '@/constants/theme';
import { makeStyles, ThemeProvider, useCurrentEventTheme, useTheme } from '@/theme';
import { SaveSheet } from '@/features/gallery/save-sheet';
import { keys, useDeletePhoto, useEvent, useMe, useSetPhotoVisibility } from '@/services/api/hooks';
import { timeAgo } from '@/utils/format';

function ActionButton({ icon: Icon, label, onPress, busy }: { icon: typeof X; label: string; onPress: () => void; busy?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={busy} style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}>
      {busy ? <ActivityIndicator color={colors.viewfinderText} /> : <Icon size={icon.md} color={colors.viewfinderText} strokeWidth={icon.stroke} />}
      <Text variant="caption" style={styles.light}>
        {label}
      </Text>
    </Pressable>
  );
}

function PhotoViewer() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { id, eventId } = useLocalSearchParams<{ id: string; eventId: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const me = useMe();
  const event = useEvent(eventId);
  const del = useDeletePhoto(eventId);
  const visibility = useSetPhotoVisibility(eventId);
  const [saving, setSaving] = useState(false);

  const photo = qc
    .getQueryData<InfiniteData<{ items: Photo[] }>>(keys.photos(eventId))
    ?.pages.flatMap((p) => p.items)
    .find((p) => p.id === id);

  if (!photo) {
    router.back();
    return null;
  }

  const isHost = event.data?.role === 'host';
  const isMine = photo.uploader.id === me.data?.id;

  function confirmDelete() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Delete this photo?', 'It will be removed from the album for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          del.mutate(photo!.id, {
            onSuccess: () => {
              void qc.invalidateQueries({ queryKey: keys.photos(eventId) });
              router.back();
            },
            onError: (e) => Alert.alert("Couldn't delete", e.message),
          }),
      },
    ]);
  }

  function toggleHidden() {
    const next = photo!.visibility === 'hidden' ? 'visible' : 'hidden';
    visibility.mutate({ photoId: photo!.id, visibility: next }, { onSuccess: () => router.back() });
  }

  return (
    <View style={styles.screen}>
      <Image
        source={{ uri: photo.url ?? undefined }}
        placeholder={{ uri: photo.thumbUrl ?? undefined }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        transition={200}
        accessibilityLabel={`Photo by ${photo.uploader.name}`}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={() => router.back()}
        style={[styles.close, { top: insets.top + space.sm }]}>
        <X size={icon.lg} color={colors.white} strokeWidth={icon.stroke} />
      </Pressable>

      <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
        <View style={styles.meta}>
          <Text variant="h3" style={styles.light}>
            {photo.uploader.name}
          </Text>
          <Text variant="caption" style={styles.dim}>
            {timeAgo(photo.createdAt)}
            {photo.visibility === 'hidden' ? ' · Hidden from guests' : ''}
          </Text>
        </View>
        <View style={styles.actions}>
          <ActionButton icon={Download} label="Save" onPress={() => setSaving(true)} />
          {isHost && (
            <ActionButton
              icon={photo.visibility === 'hidden' ? Eye : EyeOff}
              label={photo.visibility === 'hidden' ? 'Unhide' : 'Hide'}
              onPress={toggleHidden}
              busy={visibility.isPending}
            />
          )}
          {(isMine || isHost) && <ActionButton icon={Trash2} label="Delete" onPress={confirmDelete} busy={del.isPending} />}
        </View>
      </View>
      {saving && <SaveSheet photo={photo} event={event.data} onClose={() => setSaving(false)} />}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.inkDeep },
  close: {
    position: 'absolute',
    right: screenPadding,
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: screenPadding,
    paddingTop: space.lg,
    gap: space.lg,
    backgroundColor: 'rgba(23,43,35,0.85)',
  },
  meta: { gap: 2 },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1, alignItems: 'center', gap: space.xs, paddingVertical: space.sm, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.08)' },
  light: { color: colors.viewfinderText },
  dim: { color: colors.viewfinderText, opacity: 0.7 },
}));

/** Drawn in the open event's theme. */
export default function PhotoViewerScreen() {
  return (
    <ThemeProvider theme={useCurrentEventTheme()}>
      <PhotoViewer />
    </ThemeProvider>
  );
}
