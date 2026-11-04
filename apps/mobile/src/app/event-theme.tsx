import { FONT_PAIRINGS, POSTER_FRAMES, THEME_PRESETS, type EventDetail, type EventTheme } from '@eventshare/shared';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { Button, LoadingState, Pill, Segmented, Text, TextField } from '@/components/ui';
import { icon, radius, screenPadding, space } from '@/constants/theme';
import { EventPoster } from '@/features/events/event-poster';
import { ROLE_LABEL } from '@/features/events/roles';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { useUpdateEvent } from '@/services/api/hooks';
import {
  COLOR_SWATCHES,
  FONT_PAIRING_LABEL,
  headingFont,
  makeStyles,
  POSTER_FRAME_LABEL,
  PRESETS,
  presetTheme,
  themeFor,
  ThemeProvider,
  useTheme,
} from '@/theme';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const DEFAULT = presetTheme('evergreen');
const same = (a: EventTheme, b: EventTheme) => JSON.stringify(a) === JSON.stringify(b);

/** Host only: pick a ready-made theme or make your own. The whole sheet previews it live. */
export default function EventThemeScreen() {
  const { event } = useCurrentEvent();
  if (!event) return <LoadingState />;
  return <Editor event={event} />;
}

function Editor({ event }: { event: EventDetail }) {
  const saved = event.theme ?? DEFAULT;
  const [draft, setDraft] = useState<EventTheme>(saved);
  const [hex, setHex] = useState(saved.color ?? '');
  const update = useUpdateEvent(event.id);

  function pickPreset(preset: EventTheme['preset']) {
    setDraft(presetTheme(preset));
    setHex('');
  }

  function pickColor(color: string) {
    setDraft((d) => ({ ...d, color }));
    setHex(color);
  }

  function typeHex(text: string) {
    const value = text.startsWith('#') ? text : `#${text}`;
    setHex(value);
    if (HEX.test(value)) setDraft((d) => ({ ...d, color: value.toUpperCase() }));
  }

  function save() {
    update.mutate(
      { theme: same(draft, DEFAULT) ? null : draft },
      { onSuccess: () => router.back(), onError: (e) => Alert.alert("Couldn't save the theme", e.message) },
    );
  }

  return (
    <ThemeProvider theme={themeFor(draft)}>
      <Body
        event={event}
        draft={draft}
        hex={hex}
        hexError={hex && !HEX.test(hex) ? 'Use 6 digits, like #A2475E' : null}
        dirty={!same(draft, saved)}
        saving={update.isPending}
        onPreset={pickPreset}
        onColor={pickColor}
        onHex={typeHex}
        onChange={(change) => setDraft((d) => ({ ...d, ...change }))}
        onReset={() => pickPreset('evergreen')}
        onSave={save}
      />
    </ThemeProvider>
  );
}

type BodyProps = {
  event: EventDetail;
  draft: EventTheme;
  hex: string;
  hexError: string | null;
  dirty: boolean;
  saving: boolean;
  onPreset: (preset: EventTheme['preset']) => void;
  onColor: (color: string) => void;
  onHex: (text: string) => void;
  onChange: (change: Partial<EventTheme>) => void;
  onReset: () => void;
  onSave: () => void;
};

function Body({ event, draft, hex, hexError, dirty, saving, onPreset, onColor, onHex, onChange, onReset, onSave }: BodyProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const deepened = draft.color !== null && colors.primary !== draft.color;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text variant="eyebrow">Event theme</Text>
      <Text variant="h1">
        Make it <Text variant="h1" emphasis>yours.</Text>
      </Text>
      <Text color="muted">Everyone in {event.name} sees this look: the album, camera, people and invite.</Text>

      <View style={styles.preview}>
        <EventPoster event={event} />
        <View style={styles.sample}>
          <Text variant="h2">{event.name}</Text>
          <Text variant="caption" color="muted">
            Photos from everyone, in one place.
          </Text>
          <Pill label={ROLE_LABEL[event.role]} />
          <Button label="Upload" fullWidth />
        </View>
      </View>

      <Text variant="eyebrow" style={styles.section}>
        Themes
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
        {THEME_PRESETS.map((p) => {
          const selected = draft.preset === p && draft.color === null;
          return (
            <Pressable
              key={p}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${PRESETS[p].name} theme`}
              onPress={() => onPreset(p)}
              style={styles.preset}>
              <View style={[styles.ring, selected && styles.ringOn]}>
                <View style={[styles.presetDot, { backgroundColor: PRESETS[p].color }]}>
                  <Text style={[styles.presetAa, { fontFamily: headingFont(PRESETS[p].fonts) }]}>Aa</Text>
                </View>
              </View>
              <Text variant="caption" color={selected ? 'ink' : 'muted'}>
                {PRESETS[p].name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text variant="eyebrow" style={styles.section}>
        Your colour
      </Text>
      <View style={styles.swatches}>
        {COLOR_SWATCHES.map((c) => {
          const selected = draft.color === c;
          return (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Colour ${c}`}
              onPress={() => onColor(c)}
              style={[styles.ring, selected && styles.ringOn]}>
              <View style={[styles.swatch, { backgroundColor: c }]}>
                {selected && <Check size={icon.sm} color={colors.white} />}
              </View>
            </Pressable>
          );
        })}
      </View>
      <TextField
        label="Or your brand colour"
        placeholder="#A2475E"
        value={hex}
        onChangeText={onHex}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={7}
        error={hexError}
        hint={deepened ? 'Deepened a little so text on buttons stays easy to read.' : undefined}
      />

      <Text variant="eyebrow" style={styles.section}>
        Fonts
      </Text>
      <View style={styles.fonts}>
        {FONT_PAIRINGS.map((f) => {
          const selected = draft.fonts === f;
          return (
            <Pressable
              key={f}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${FONT_PAIRING_LABEL[f]} fonts`}
              onPress={() => onChange({ fonts: f })}
              style={[styles.font, selected && styles.fontOn]}>
              <Text style={[styles.fontAa, { fontFamily: headingFont(f) }]}>Aa</Text>
              <Text variant="caption" color={selected ? 'ink' : 'muted'}>
                {FONT_PAIRING_LABEL[f]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text variant="eyebrow" style={styles.section}>
        Poster frame
      </Text>
      <Segmented
        accessibilityLabel="Poster frame"
        options={POSTER_FRAMES.map((f) => ({ value: f, label: POSTER_FRAME_LABEL[f] }))}
        value={draft.frame}
        onChange={(frame) => onChange({ frame })}
      />

      <View style={styles.actions}>
        <Button label="Save theme" fullWidth disabled={!dirty || !!hexError} loading={saving} onPress={onSave} />
        <Button label="Use eventShare’s look" variant="ghost" fullWidth onPress={onReset} />
      </View>
    </ScrollView>
  );
}

const DOT = 48;

const useStyles = makeStyles(({ colors, fonts }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { padding: screenPadding, paddingTop: space['3xl'], paddingBottom: space['4xl'], gap: space.sm },
  preview: { flexDirection: 'row', gap: space.lg, marginTop: space.md },
  sample: { flex: 1, gap: space.sm, justifyContent: 'center', alignItems: 'flex-start' },
  section: { marginTop: space.xl },
  presets: { gap: space.md, paddingVertical: space.xs },
  preset: { alignItems: 'center', gap: space.xs },
  ring: { padding: 3, borderRadius: radius.full, borderWidth: 2, borderColor: 'transparent' },
  ringOn: { borderColor: colors.ink },
  presetDot: { width: DOT, height: DOT, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  presetAa: { color: colors.white, fontSize: 18 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  swatch: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  fonts: { flexDirection: 'row', gap: space.sm },
  font: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  fontOn: { borderColor: colors.ink, borderWidth: 2 },
  fontAa: { fontSize: 26, lineHeight: 32, color: colors.ink, fontFamily: fonts.serif },
  actions: { gap: space.sm, marginTop: space['2xl'] },
}));
