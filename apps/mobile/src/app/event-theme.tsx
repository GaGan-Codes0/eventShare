import { FONT_PAIRINGS, POSTER_FRAMES, THEME_ACCENTS, THEME_PRESETS, type EventDetail, type EventImageKind, type EventTheme } from '@eventshare/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Check, ImagePlus } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';

import { Button, LoadingState, Pill, Segmented, Text, TextField } from '@/components/ui';
import { icon, radius, screenPadding, space } from '@/constants/theme';
import { EventLogo, pickEventImage } from '@/features/events/event-images';
import { EventPoster } from '@/features/events/event-poster';
import { ROLE_LABEL } from '@/features/events/roles';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { useUpdateEvent } from '@/services/api/hooks';
import {
  FONT_PAIRING_LABEL,
  headingFont,
  makeStyles,
  POSTER_FRAME_LABEL,
  PRESETS,
  DEFAULT_EVENT_THEME,
  themeFor,
  ThemeProvider,
  useTheme,
} from '@/theme';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const DEFAULT = DEFAULT_EVENT_THEME;
const same = (a: EventTheme, b: EventTheme) => JSON.stringify(a) === JSON.stringify(b);

/** A logo / poster picked in this sheet and already uploaded; key null means removed. */
type Picked = { key: string | null; uri: string | null };

/** Host only: pick a ready-made theme or make your own. The whole sheet previews it live. */
export default function EventThemeScreen() {
  const { event } = useCurrentEvent();
  if (!event) return <LoadingState />;
  return <Editor event={event} />;
}

function Editor({ event }: { event: EventDetail }) {
  const saved = event.theme ?? DEFAULT;
  const [draft, setDraft] = useState<EventTheme>(saved);
  const [hex, setHex] = useState(saved.accent ?? '');
  const [images, setImages] = useState<Partial<Record<EventImageKind, Picked>>>({});
  const [busy, setBusy] = useState<EventImageKind | null>(null);
  const update = useUpdateEvent(event.id);

  const current = { logo: event.logoUrl, poster: event.posterUrl };
  const uriOf = (kind: EventImageKind) => (images[kind] ? images[kind].uri : current[kind]);
  // A removed poster falls back to the newest photo, which only the server knows; show none until saved.
  const cover = images.poster ? (images.poster.uri ?? (event.posterUrl ? null : event.coverUrl)) : event.coverUrl;
  const previewEvent = { ...event, coverUrl: cover, logoUrl: uriOf('logo') };

  async function chooseImage(kind: EventImageKind) {
    setBusy(kind);
    try {
      const picked = await pickEventImage(event.id, kind);
      if (picked) setImages((i) => ({ ...i, [kind]: picked }));
    } catch (e) {
      Alert.alert(`Couldn't add the ${kind}`, e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function pickPreset(preset: EventTheme['preset']) {
    // A new look keeps your fonts and frame, and uses its own accent.
    setDraft((d) => ({ ...d, preset, accent: null }));
    setHex('');
  }

  function pickColor(color: string) {
    setDraft((d) => ({ ...d, accent: color }));
    setHex(color);
  }

  function typeHex(text: string) {
    const value = text.startsWith('#') ? text : `#${text}`;
    setHex(value);
    if (HEX.test(value)) setDraft((d) => ({ ...d, accent: value.toUpperCase() }));
  }

  function save() {
    update.mutate(
      {
        theme: same(draft, DEFAULT) ? null : draft,
        ...(images.poster && { posterKey: images.poster.key }),
        ...(images.logo && { logoKey: images.logo.key }),
      },
      { onSuccess: () => router.back(), onError: (e) => Alert.alert("Couldn't save the theme", e.message) },
    );
  }

  return (
    <ThemeProvider theme={themeFor(draft)}>
      <Body
        event={previewEvent}
        draft={draft}
        posterUri={uriOf('poster')}
        logoUri={uriOf('logo')}
        busy={busy}
        onPickImage={chooseImage}
        onRemoveImage={(kind) => setImages((i) => ({ ...i, [kind]: { key: null, uri: null } }))}
        hex={hex}
        hexError={hex && !HEX.test(hex) ? 'Use 6 digits, like #A2475E' : null}
        dirty={!same(draft, saved) || Object.keys(images).length > 0}
        saving={update.isPending || busy !== null}
        onPreset={pickPreset}
        onColor={pickColor}
        onHex={typeHex}
        onChange={(change) => setDraft((d) => ({ ...d, ...change }))}
        onReset={() => {
          setDraft(DEFAULT);
          setHex('');
        }}
        onSave={save}
      />
    </ThemeProvider>
  );
}

type BodyProps = {
  event: EventDetail;
  draft: EventTheme;
  posterUri: string | null;
  logoUri: string | null;
  busy: EventImageKind | null;
  onPickImage: (kind: EventImageKind) => void;
  onRemoveImage: (kind: EventImageKind) => void;
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

function Body({ event, draft, posterUri, logoUri, busy, onPickImage, onRemoveImage, hex, hexError, dirty, saving, onPreset, onColor, onHex, onChange, onReset, onSave }: BodyProps) {
  const { colors } = useTheme();
  const styles = useStyles();

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
        Poster and logo
      </Text>
      <View style={styles.images}>
        <ImageSlot kind="poster" label="Poster" uri={posterUri} busy={busy === 'poster'} onPick={onPickImage} onRemove={onRemoveImage} />
        <ImageSlot kind="logo" label="Logo" uri={logoUri} busy={busy === 'logo'} onPick={onPickImage} onRemove={onRemoveImage} />
        <Text variant="caption" color="muted" style={styles.flex}>
          The poster is the event’s cover, instead of the newest photo. The logo sits on the poster and the album.
        </Text>
      </View>

      <Text variant="eyebrow" style={styles.section}>
        Themes
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
        {THEME_PRESETS.map((p) => {
          const selected = draft.preset === p;
          return (
            <Pressable
              key={p}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${PRESETS[p].name} theme`}
              onPress={() => onPreset(p)}
              style={styles.preset}>
              <View style={[styles.ring, selected && styles.ringOn]}>
                <View style={[styles.presetDot, { backgroundColor: PRESETS[p].bg, borderColor: PRESETS[p].line }]}>
                  <Text style={[styles.presetAa, { color: PRESETS[p].accent, fontFamily: headingFont(draft.fonts) }]}>Aa</Text>
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
        Accent
      </Text>
      <View style={styles.swatches}>
        {THEME_ACCENTS.map((c) => {
          const selected = draft.accent === c;
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
        label="Or your own colour"
        placeholder="#A2475E"
        value={hex}
        onChangeText={onHex}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={7}
        error={hexError}
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

type SlotProps = {
  kind: EventImageKind;
  label: string;
  uri: string | null;
  busy: boolean;
  onPick: (kind: EventImageKind) => void;
  onRemove: (kind: EventImageKind) => void;
};

/** Tap to add or change the poster / logo; Remove underneath once there is one. */
function ImageSlot({ kind, label, uri, busy, onPick, onRemove }: SlotProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.slot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={uri ? `Change ${kind}` : `Add ${kind}`}
        disabled={busy}
        onPress={() => onPick(kind)}
        style={[styles.slotBox, kind === 'poster' && styles.slotPoster, !uri && styles.slotEmpty]}>
        {busy ? (
          <ActivityIndicator color={colors.primary} />
        ) : uri ? (
          kind === 'logo' ? (
            <EventLogo uri={uri} size={SLOT} />
          ) : (
            <Image source={{ uri }} style={styles.slotImage} contentFit="cover" />
          )
        ) : (
          <ImagePlus size={icon.md} color={colors.accent} />
        )}
      </Pressable>
      {uri && !busy ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${kind}`} hitSlop={8} onPress={() => onRemove(kind)}>
          <Text variant="caption" color="danger">
            Remove
          </Text>
        </Pressable>
      ) : (
        <Text variant="caption" color="muted">
          {label}
        </Text>
      )}
    </View>
  );
}

const DOT = 48;
const SLOT = 72;

const useStyles = makeStyles(({ colors, fonts }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { padding: screenPadding, paddingTop: space['3xl'], paddingBottom: space['4xl'], gap: space.sm },
  preview: { flexDirection: 'row', gap: space.lg, marginTop: space.md },
  sample: { flex: 1, gap: space.sm, justifyContent: 'center', alignItems: 'flex-start' },
  section: { marginTop: space.xl },
  images: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  flex: { flex: 1, paddingTop: space.xs },
  slot: { alignItems: 'center', gap: space.xs },
  slotBox: {
    width: SLOT,
    height: SLOT,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotPoster: { height: SLOT / 0.9 },
  slotEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.lineStrong, backgroundColor: colors.field },
  slotImage: { width: '100%', height: '100%' },
  presets: { gap: space.md, paddingVertical: space.xs },
  preset: { alignItems: 'center', gap: space.xs },
  ring: { padding: 3, borderRadius: radius.full, borderWidth: 2, borderColor: 'transparent' },
  ringOn: { borderColor: colors.ink },
  presetDot: { width: DOT, height: DOT, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  presetAa: { fontSize: 18 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  swatch: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  fonts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  font: {
    width: '31.5%',
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
