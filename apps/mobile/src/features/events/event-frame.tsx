import { Image } from 'expo-image';
import type { ComponentRef, Ref } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';

import { EventLogo } from './event-images';

/** Laid out at this many points wide; captured at the phone's pixel density (about 2000px). */
export const FRAMED_COPY_WIDTH = 720;
const PAD = 32;

type FramedCopyProps = {
  ref?: Ref<ComponentRef<typeof View>>;
  uri: string;
  /** Photo width / height. */
  ratio: number;
  eventName: string;
  date: string | null;
  logoUrl: string | null;
  onLoad?: (size: { width: number; height: number }) => void;
  /** Its full (unscaled) height, for callers that show it smaller. */
  onHeight?: (height: number) => void;
};

/**
 * A keepsake copy: the photo on a mat in the event's theme, with the event's name, date and
 * logo. Rendered as a normal view and captured to an image; the original is never touched.
 */
export function FramedCopy({ ref, uri, ratio, eventName, date, logoUrl, onLoad, onHeight }: FramedCopyProps) {
  const { frame, colors } = useTheme();
  const styles = useStyles();
  const light = frame === 'polaroid';
  const inner = FRAMED_COPY_WIDTH - PAD * 2;
  const text = light ? colors.ink : colors.viewfinderText;
  return (
    <View ref={ref} collapsable={false} onLayout={(e) => onHeight?.(e.nativeEvent.layout.height)} style={[styles.copy, { backgroundColor: light ? colors.surface : colors.viewfinder }]}>
      <View style={{ width: inner, height: inner / ratio }}>
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onLoad={(e) => onLoad?.({ width: e.source.width, height: e.source.height })}
        />
        {(frame === 'line' || frame === 'double') && <View style={[styles.copyRule, styles.copyOuter]} />}
        {frame === 'double' && <View style={[styles.copyRule, styles.copyInner]} />}
      </View>
      <View style={styles.caption}>
        {logoUrl && <EventLogo uri={logoUrl} size={84} />}
        <View style={styles.captionText}>
          <Text variant="display" style={[styles.name, { color: text }]} numberOfLines={2}>
            {eventName}
          </Text>
          {date && <Text style={[styles.date, { color: text }]}>{date}</Text>}
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, fonts }) => ({
  copy: { width: FRAMED_COPY_WIDTH, padding: PAD, paddingBottom: PAD + space.sm },
  copyRule: { position: 'absolute', borderWidth: 2, borderColor: colors.viewfinderAccent },
  copyOuter: { top: 16, left: 16, right: 16, bottom: 16 },
  copyInner: { top: 26, left: 26, right: 26, bottom: 26 },
  caption: { flexDirection: 'row', alignItems: 'center', gap: space.xl, paddingTop: PAD },
  captionText: { flex: 1, gap: space.xs },
  name: { fontSize: 48, lineHeight: 54 },
  date: { fontFamily: fonts.sansMedium, fontSize: 22, lineHeight: 28, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.75 },
}));

type HostFramedCopyProps = {
  ref?: Ref<ComponentRef<typeof View>>;
  uri: string;
  frameUrl: string;
  /** Frame width / height, once its image has loaded. */
  frameRatio: number;
  onFrameLoad: (size: { width: number; height: number }) => void;
  onPhotoLoad?: () => void;
};

/**
 * The photo inside the host's own frame: the frame's shape and size, the photo filling it behind,
 * the frame (a PNG with a see-through window) on top. Captured to an image like FramedCopy.
 */
export function HostFramedCopy({ ref, uri, frameUrl, frameRatio, onFrameLoad, onPhotoLoad }: HostFramedCopyProps) {
  return (
    <View ref={ref} collapsable={false} style={{ width: FRAMED_COPY_WIDTH, height: FRAMED_COPY_WIDTH / frameRatio, backgroundColor: '#FFFFFF' }}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" onLoad={() => onPhotoLoad?.()} />
      <Image
        source={{ uri: frameUrl }}
        style={StyleSheet.absoluteFill}
        contentFit="fill"
        onLoad={(e) => onFrameLoad({ width: e.source.width, height: e.source.height })}
      />
    </View>
  );
}
