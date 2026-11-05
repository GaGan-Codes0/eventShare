import {
  FONT_PAIRINGS,
  PHOTO_FILTERS,
  POSTER_FRAMES,
  THEME_ACCENTS,
  THEME_PRESETS,
  type FontPairing,
  type PhotoFilter,
  type PosterFrame,
  type RevealMode,
  type ThemePreset,
} from '@eventshare/shared';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Segmented, Text } from '@/components/ui';
import { icon, radius, space } from '@/constants/theme';
import { FILTER_LABEL, FilteredImage, useLookSample } from '@/features/gallery/photo-filters';
import { FONT_PAIRING_LABEL, headingFont, headingScale, makeStyles, POSTER_FRAME_LABEL, PRESETS, useTheme } from '@/theme';

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** The six looks as small cards: three dots of the look's colours and its name. */
export function ThemeGrid({ value, onChange }: { value: ThemePreset; onChange: (preset: ThemePreset) => void }) {
  const styles = useStyles();
  return (
    <View style={styles.grid}>
      {THEME_PRESETS.map((p) => {
        const look = PRESETS[p];
        const selected = value === p;
        return (
          <Pressable
            key={p}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${look.name} theme`}
            onPress={() => onChange(p)}
            style={[styles.option, styles.third, { backgroundColor: look.bg }, selected && styles.optionOn]}>
            <View style={styles.dots}>
              {[look.accent, look.soft, look.ink].map((c) => (
                <View key={c} style={[styles.dot, { backgroundColor: c }]} />
              ))}
            </View>
            <Text variant="caption" style={{ color: look.ink }}>
              {look.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The six heading fonts, each showing the event's own name. */
export function FontGrid({ value, name, onChange }: { value: FontPairing; name: string; onChange: (font: FontPairing) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.grid}>
      {FONT_PAIRINGS.map((f) => {
        const selected = value === f;
        return (
          <Pressable
            key={f}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${FONT_PAIRING_LABEL[f]} font`}
            onPress={() => onChange(f)}
            style={[styles.option, styles.half, selected && styles.optionOn]}>
            <Text numberOfLines={1} style={{ fontFamily: headingFont(f), fontSize: 21 * headingScale(f), lineHeight: 26, color: colors.ink }}>
              {name}
            </Text>
            <Text variant="caption" color="muted">
              {FONT_PAIRING_LABEL[f]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const REVEALS: { value: RevealMode; label: string; caption: string }[] = [
  { value: 'live', label: 'Live, as they’re taken', caption: 'Everyone sees new photos instantly.' },
  { value: 'after', label: 'When the event ends', caption: 'Builds anticipation. Opens at the end.' },
  { value: 'morning', label: 'Next morning, 9 AM', caption: 'Like collecting prints from the lab.' },
];

/** When the album opens, in this phone's local time: the end of the event's day, or 9 AM the next day. */
export function opensAt(mode: RevealMode, startsAt: string | null): string | null {
  if (mode === 'live') return null;
  const day = startsAt ? new Date(startsAt) : new Date();
  const at = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  if (mode === 'after') {
    at.setHours(23, 59, 0, 0);
  } else {
    at.setDate(at.getDate() + 1);
    at.setHours(9, 0, 0, 0);
  }
  return at.toISOString();
}

/** The three album-opening choices as radio rows. */
export function RevealOptions({ value, onChange }: { value: RevealMode; onChange: (mode: RevealMode) => void }) {
  const styles = useStyles();
  return (
    <View style={styles.group}>
      {REVEALS.map((r, i) => {
        const selected = value === r.value;
        return (
          <Pressable
            key={r.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(r.value)}
            style={[styles.row, i > 0 && styles.divider]}>
            <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
            <View style={styles.flex}>
              <Text variant="bodyStrong">{r.label}</Text>
              <Text variant="caption" color="muted">
                {r.caption}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The eight accents plus "your own colour". null means the theme's own accent. The typed colour
 * is applied once it's a full #RRGGBB.
 */
export function AccentPicker({ value, onChange }: { value: string | null; onChange: (accent: string | null) => void }) {
  const { colors, fonts } = useTheme();
  const styles = useStyles();
  const [hex, setHex] = useState(value ?? '');
  // A swatch or reset from outside the field (or another screen) shows in it too.
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setHex(value ?? '');
  }
  function type(text: string) {
    const v = text.startsWith('#') ? text : `#${text}`;
    setHex(v);
    if (HEX.test(v)) onChange(v.toUpperCase());
  }
  return (
    <View style={styles.accent}>
      <View style={styles.spread}>
        <Text variant="label" style={{ color: colors.accent }}>
          Accent
        </Text>
        {value && (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => onChange(null)}>
            <Text variant="label" style={{ color: colors.primaryText }}>
              Use theme accent
            </Text>
          </Pressable>
        )}
      </View>
      <View style={styles.swatches}>
        {THEME_ACCENTS.map((c) => {
          const selected = value === c;
          return (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Accent ${c}`}
              onPress={() => onChange(c)}
              style={[styles.ring, selected && styles.ringOn]}>
              <View style={[styles.swatch, { backgroundColor: c }]}>{selected && <Check size={icon.sm} color={colors.white} />}</View>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={hex}
        onChangeText={type}
        placeholder="Or your own colour, e.g. #A2475E"
        placeholderTextColor={colors.subtle}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={7}
        returnKeyType="done"
        style={[styles.field, { fontFamily: fonts.sans, color: colors.ink }]}
      />
    </View>
  );
}

/** None / polaroid / ... around the event's cover. */
export function FramePicker({ value, onChange }: { value: PosterFrame; onChange: (frame: PosterFrame) => void }) {
  return (
    <Segmented
      accessibilityLabel="Poster frame"
      options={POSTER_FRAMES.map((f) => ({ value: f, label: POSTER_FRAME_LABEL[f] }))}
      value={value}
      onChange={onChange}
    />
  );
}

/** The four photo looks, each drawn on a sample picture (the event's own, else a built-in one). */
export function LookPicker({ value, sample, onChange }: { value: PhotoFilter; sample: string | null | undefined; onChange: (f: PhotoFilter) => void }) {
  const { fonts } = useTheme();
  const styles = useStyles();
  const fallback = useLookSample();
  const picture = sample || fallback;
  return (
    <View style={styles.grid4}>
      {PHOTO_FILTERS.map((f) => {
        const selected = value === f;
        return (
          <Pressable
            key={f}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${FILTER_LABEL[f]} look`}
            onPress={() => onChange(f)}
            style={styles.quarter}>
            <View style={[styles.filterTile, selected && styles.filterOn]}>
              <FilteredImage uri={picture} filter={f} style={StyleSheet.absoluteFill} />
            </View>
            <Text variant="caption" align="center" style={selected && { fontFamily: fonts.sansSemiBold }}>
              {FILTER_LABEL[f]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  accent: { gap: space.sm + 2 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  ring: { padding: 2, borderRadius: radius.full, borderWidth: 2, borderColor: 'transparent' },
  ringOn: { borderColor: colors.ink },
  swatch: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  field: { height: 46, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface, fontSize: 15 },
  grid4: { flexDirection: 'row', gap: space.sm },
  quarter: { flex: 1, gap: 6 },
  filterTile: { aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.sage, borderWidth: 2, borderColor: 'transparent' },
  filterOn: { borderColor: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  half: { width: '48.5%' },
  third: { width: '31.8%' },
  option: { borderRadius: 14, padding: space.sm + 2, gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  optionOn: { borderWidth: 2, borderColor: colors.primary },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 18, height: 18, borderRadius: 9 },
  group: { borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg - 2 },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  flex: { flex: 1, gap: 2 },
}));
