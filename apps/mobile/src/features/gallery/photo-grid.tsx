import type { Photo, PhotoFilter } from '@eventshare/shared';
import { File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { Aperture, CloudUpload, EyeOff, Mic, Play, TriangleAlert } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { space } from '@/constants/theme';
import type { QueueItem } from '@/features/uploads/queue';

import { FilteredImage } from './photo-filters';
import { makeStyles, useTheme } from '@/theme';
import { clock } from '@/utils/format';

/** A photo still on this phone (uploading) or one in the album. */
export type Tile = { kind: 'local'; item: QueueItem } | { kind: 'remote'; photo: Photo };

export const tileKey = (t: Tile) => (t.kind === 'local' ? `local-${t.item.id}` : t.photo.id);

/** One 4:5 tile: photographer badge, "In review" on your own waiting photos, hidden mark for the host. */
export function PhotoCell({ tile, meId, onOpen, filter = 'natural' }: { tile: Tile; meId?: string; onOpen?: (photo: Photo) => void; filter?: PhotoFilter }) {
  const { colors } = useTheme();
  const styles = useStyles();
  if (tile.kind === 'local') {
    const failed = Boolean(tile.item.permanent);
    return (
      <View style={styles.cell} accessibilityLabel={failed ? `Couldn't upload: ${tile.item.error ?? ''}` : 'Uploading, saved on this phone'}>
        {tile.item.thumbName ? (
          <Image source={{ uri: new File(Paths.document, 'uploads', tile.item.thumbName).uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <VoiceFace />
        )}
        <View style={styles.localShade} />
        {tile.item.kind && tile.item.kind !== 'photo' && <Length kind={tile.item.kind} ms={tile.item.durationMs ?? 0} />}
        <View style={styles.localIcon}>
          {failed ? <TriangleAlert size={16} color={colors.white} /> : <CloudUpload size={16} color={colors.white} />}
        </View>
      </View>
    );
  }
  const p = tile.photo;
  const byPhotographer = p.uploader.role === 'photographer';
  const what = p.kind === 'video' ? 'Video' : p.kind === 'voice' ? 'Voice note' : 'Photo';
  const length = p.durationMs ? `, ${clock(p.durationMs)}` : '';
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={`${what}${length} by ${p.uploader.name}${byPhotographer ? ', photographer' : ''}${p.pendingReview ? ', in review' : ''}`}
      onPress={() => onOpen?.(p)}
      style={({ pressed }) => [styles.cell, pressed && { opacity: 0.85 }]}>
      {p.kind === 'voice' ? (
        <VoiceFace name={p.uploader.name} />
      ) : (
        // The event's look is for photos; videos show as they were filmed.
        <FilteredImage uri={p.thumbUrl} filter={p.kind === 'video' ? 'natural' : filter} style={StyleSheet.absoluteFill} />
      )}
      {p.kind !== 'photo' && <Length kind={p.kind} ms={p.durationMs ?? 0} />}
      {byPhotographer && (
        <View style={styles.badge}>
          <Aperture size={11} color={colors.white} />
        </View>
      )}
      {p.visibility === 'hidden' && (
        <View style={[styles.badge, styles.badgeRight]}>
          <EyeOff size={11} color={colors.white} />
        </View>
      )}
      {p.pendingReview && (meId === p.uploader.id || meId === undefined) && (
        <View style={styles.review}>
          <Text style={styles.reviewText}>In review</Text>
        </View>
      )}
    </Pressable>
  );
}

/** A voice note's tile: a microphone on the event's soft colour, with who left it. */
function VoiceFace({ name }: { name?: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[StyleSheet.absoluteFill, styles.voice]}>
      <View style={styles.voiceIcon}>
        <Mic size={18} color={colors.primaryText} />
      </View>
      {name && (
        <Text variant="caption" numberOfLines={1} style={styles.voiceName}>
          {name.split(' ')[0]}
        </Text>
      )}
    </View>
  );
}

/** "▶ 0:42" on a video, "0:18" on a voice note. */
function Length({ kind, ms }: { kind: 'video' | 'voice'; ms: number }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.length}>
      {kind === 'video' && <Play size={9} color={colors.white} fill={colors.white} />}
      <Text style={styles.lengthText}>{clock(ms)}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors, fonts }) => ({
  cell: { flex: 1, aspectRatio: 4 / 5, borderRadius: space.sm, overflow: 'hidden', backgroundColor: colors.sage },
  badge: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRight: { left: undefined, right: 5 },
  review: { position: 'absolute', left: 5, bottom: 5, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.92)' },
  reviewText: { fontFamily: fonts.sansSemiBold, fontSize: 9.5, lineHeight: 13, color: '#273C32' },
  localShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  localIcon: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  voice: { backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center', gap: 6, padding: space.sm },
  voiceIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  voiceName: { color: colors.muted, maxWidth: '100%' },
  length: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  lengthText: { fontFamily: fonts.mono, fontSize: 10, lineHeight: 13, color: '#FFFFFF' },
}));
