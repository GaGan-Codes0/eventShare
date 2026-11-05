import type { Photo } from '@eventshare/shared';
import { File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { Aperture, CloudUpload, EyeOff, TriangleAlert } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { space } from '@/constants/theme';
import type { QueueItem } from '@/features/uploads/queue';
import { makeStyles, useTheme } from '@/theme';

/** A photo still on this phone (uploading) or one in the album. */
export type Tile = { kind: 'local'; item: QueueItem } | { kind: 'remote'; photo: Photo };

export const tileKey = (t: Tile) => (t.kind === 'local' ? `local-${t.item.id}` : t.photo.id);

/** One 4:5 tile: photographer badge, "In review" on your own waiting photos, hidden mark for the host. */
export function PhotoCell({ tile, meId, onOpen }: { tile: Tile; meId?: string; onOpen?: (photo: Photo) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  if (tile.kind === 'local') {
    const failed = Boolean(tile.item.permanent);
    return (
      <View style={styles.cell} accessibilityLabel={failed ? `Couldn't upload: ${tile.item.error ?? ''}` : 'Uploading, saved on this phone'}>
        <Image source={{ uri: new File(Paths.document, 'uploads', tile.item.thumbName).uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={styles.localShade} />
        <View style={styles.localIcon}>
          {failed ? <TriangleAlert size={16} color={colors.white} /> : <CloudUpload size={16} color={colors.white} />}
        </View>
      </View>
    );
  }
  const p = tile.photo;
  const byPhotographer = p.uploader.role === 'photographer';
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={`Photo by ${p.uploader.name}${byPhotographer ? ', photographer' : ''}${p.pendingReview ? ', in review' : ''}`}
      onPress={() => onOpen?.(p)}
      style={({ pressed }) => [styles.cell, pressed && { opacity: 0.85 }]}>
      {p.thumbUrl && <Image source={{ uri: p.thumbUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />}
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
}));
