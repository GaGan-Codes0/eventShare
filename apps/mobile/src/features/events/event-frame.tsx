import { Image } from 'expo-image';
import type { ComponentRef, Ref } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';

import { EventLogo } from './event-images';

/**
 * Optional frame over the live viewfinder, in the event's theme. Only on screen: the photo
 * itself is always taken clean. Events without a frame style get a simple line.
 */
export function ViewfinderFrame({ logoUrl }: { logoUrl: string | null }) {
  const { frame } = useTheme();
  const styles = useStyles();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {frame === 'polaroid' ? (
        <View style={[StyleSheet.absoluteFill, styles.mat]} />
      ) : (
        <View style={[styles.rule, styles.outer]} />
      )}
      {frame === 'double' && <View style={[styles.rule, styles.inner]} />}
      {logoUrl && (
        <View style={[styles.logo, frame === 'polaroid' && styles.logoOnMat]}>
          <EventLogo uri={logoUrl} size={frame === 'polaroid' ? 30 : 36} />
        </View>
      )}
    </View>
  );
}

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
  rule: { position: 'absolute', borderWidth: 1.5, borderColor: colors.viewfinderText, opacity: 0.85 },
  outer: { top: 12, left: 12, right: 12, bottom: 12, borderRadius: radius.lg },
  inner: { top: 18, left: 18, right: 18, bottom: 18, borderRadius: radius.md },
  mat: { borderWidth: 10, borderBottomWidth: 44, borderColor: colors.surface },
  logo: { position: 'absolute', right: 24, bottom: 24 },
  logoOnMat: { right: 14, bottom: 7 },

  copy: { width: FRAMED_COPY_WIDTH, padding: PAD, paddingBottom: PAD + space.sm },
  copyRule: { position: 'absolute', borderWidth: 2, borderColor: colors.viewfinderAccent },
  copyOuter: { top: 16, left: 16, right: 16, bottom: 16 },
  copyInner: { top: 26, left: 26, right: 26, bottom: 26 },
  caption: { flexDirection: 'row', alignItems: 'center', gap: space.xl, paddingTop: PAD },
  captionText: { flex: 1, gap: space.xs },
  name: { fontSize: 48, lineHeight: 54 },
  date: { fontFamily: fonts.sansMedium, fontSize: 22, lineHeight: 28, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.75 },
}));
