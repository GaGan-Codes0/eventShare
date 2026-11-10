import { EVENT_IMAGE_MAX_EDGE, type EventImageKind, type EventImageUpload } from '@eventshare/shared';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { View } from 'react-native';

import { radius } from '@/constants/theme';
import { api } from '@/services/api/client';
import { makeStyles } from '@/theme';

/**
 * Host picks a logo or poster from their library: cropped, shrunk on the phone, then uploaded
 * straight to storage. Returns the key to save on the event, or null if they cancelled.
 */
export async function pickEventImage(eventId: string, kind: EventImageKind): Promise<{ key: string; uri: string } | null> {
  // A frame is used exactly as designed: no cropping, which would also lose its see-through parts.
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: kind !== 'frame',
    aspect: kind === 'logo' ? [1, 1] : [9, 10],
    quality: 1,
  });
  if (res.canceled) return null;
  return uploadEventImage(eventId, kind, res.assets[0].uri);
}

/** Shrinks a picked image on the phone and uploads it straight to storage; returns its key. */
export async function uploadEventImage(eventId: string, kind: EventImageKind, uri: string): Promise<{ key: string; uri: string }> {
  const edge = EVENT_IMAGE_MAX_EDGE[kind];
  const rendered = await ImageManipulator.manipulate(uri, { maxWidth: edge, maxHeight: edge }).renderAsync();
  // Logos and frames keep their transparent parts; posters are photos.
  const png = kind !== 'poster';
  const saved = png ? await rendered.saveAsync({ format: SaveFormat.PNG }) : await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  const contentType = png ? 'image/png' : 'image/jpeg';
  const file = new File(saved.uri);

  const ticket = await api<EventImageUpload>(`/events/${eventId}/images`, {
    body: { kind, contentType, byteSize: file.size },
  });
  const put = await file.upload(ticket.upload.url, { httpMethod: 'PUT', headers: ticket.upload.headers });
  if (put.status < 200 || put.status >= 300) throw new Error(`Upload failed (${put.status})`);
  return { key: ticket.key, uri: saved.uri };
}

/** The host's logo on a small light tile, so dark and transparent logos read on any background. */
export function EventLogo({ uri, size = 32 }: { uri: string; size?: number }) {
  const styles = useStyles();
  return (
    <View style={[styles.tile, { width: size, height: size, padding: Math.round(size / 10) }]}>
      <Image source={{ uri }} style={styles.image} contentFit="contain" />
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  tile: { borderRadius: radius.sm, backgroundColor: colors.surface, overflow: 'hidden' },
  image: { flex: 1 },
}));
