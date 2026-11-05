import { FONT_PAIRINGS, THEME_PRESETS, type FontPairing, type RevealMode, type ThemePreset } from '@eventshare/shared';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { FONT_PAIRING_LABEL, headingFont, headingScale, makeStyles, PRESETS, useTheme } from '@/theme';

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

const useStyles = makeStyles(({ colors }) => ({
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
