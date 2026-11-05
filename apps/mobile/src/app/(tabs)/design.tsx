import {
  NAME_JOINERS,
  PHOTO_FILTERS,
  POSTER_FRAMES,
  THEME_ACCENTS,
  type EventDetail,
  type EventImageKind,
  type EventTheme,
  type PhotoFilter,
  type UpdateEventInput,
} from '@eventshare/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Check, Images, Upload } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { toast } from '@/components/toast';
import { LoadingState, Segmented, Text } from '@/components/ui';
import { icon, radius, screenPadding, space } from '@/constants/theme';
import { EventBadge } from '@/features/events/event-card';
import { HostHeader } from '@/features/events/event-header';
import { FontGrid, ThemeGrid } from '@/features/events/look-pickers';
import { pickEventImage } from '@/features/events/event-images';
import { longDate, stampText } from '@/features/events/identity';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { usePhotos, useUpdateEvent } from '@/services/api/hooks';
import { DEFAULT_EVENT_THEME, makeStyles, POSTER_FRAME_LABEL, useTheme } from '@/theme';

const HEX = /^#[0-9A-Fa-f]{6}$/;

const FILTER_LABEL: Record<PhotoFilter, string> = { natural: 'Natural', golden: 'Golden hour', mono: 'Mono', faded: 'Faded film' };

/** Host: how the event looks to every guest. Changes go out as you make them. */
export default function DesignStudio() {
  const { event } = useCurrentEvent();
  if (!event) return <LoadingState />;
  return <Studio event={event} />;
}

function Studio({ event }: { event: EventDetail }) {
  const { colors, fonts } = useTheme();
  const styles = useStyles();
  const update = useUpdateEvent(event.id);
  const photos = usePhotos(event.id);
  const theme = event.theme ?? DEFAULT_EVENT_THEME;
  const [busy, setBusy] = useState<EventImageKind | null>(null);
  const [hex, setHex] = useState(theme.accent ?? '');
  const [names, setNames] = useState({
    name: event.name,
    partner1: event.partner1 ?? '',
    partner2: event.partner2 ?? '',
    organizer: event.organizer ?? '',
    tagline: event.tagline ?? '',
  });
  const wedding = event.type === 'wedding';
  const sample = photos.data?.pages[0]?.items[0]?.thumbUrl ?? event.coverUrl;

  function save(change: UpdateEventInput) {
    update.mutate(change, { onError: (e) => Alert.alert("Couldn't save", e.message) });
  }

  function setTheme(change: Partial<EventTheme>) {
    save({ theme: { ...theme, ...change } });
  }

  /** Text fields save when you're done typing in them. */
  function saveNames() {
    const change: UpdateEventInput = {};
    if (wedding) {
      if (names.partner1.trim() && names.partner1.trim() !== event.partner1) change.partner1 = names.partner1;
      if (names.partner2.trim() && names.partner2.trim() !== event.partner2) change.partner2 = names.partner2;
    } else {
      if (names.name.trim().length >= 2 && names.name.trim() !== event.name) change.name = names.name;
      if (names.organizer.trim() !== (event.organizer ?? '')) change.organizer = names.organizer;
    }
    if (names.tagline.trim() !== (event.tagline ?? '')) change.tagline = names.tagline;
    if (Object.keys(change).length) save(change);
  }

  async function chooseImage(kind: EventImageKind) {
    setBusy(kind);
    try {
      const picked = await pickEventImage(event.id, kind);
      if (picked) {
        update.mutate(kind === 'logo' ? { logoKey: picked.key } : { posterKey: picked.key }, {
          onSuccess: () => toast(kind === 'logo' ? 'Logo updated on every guest phone' : 'Cover updated for every guest'),
          onError: (e) => Alert.alert(`Couldn't save the ${kind}`, e.message),
        });
      }
    } catch (e) {
      Alert.alert(`Couldn't add the ${kind}`, e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function typeHex(text: string) {
    const value = text.startsWith('#') ? text : `#${text}`;
    setHex(value);
    if (HEX.test(value)) setTheme({ accent: value.toUpperCase() });
  }

  return (
    <View style={styles.screen}>
      <HostHeader event={event} title="Design studio" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* What a guest sees, in the event's look as it is right now. */}
        <View style={styles.preview}>
          <View style={styles.previewHead}>
            <Text variant="eyebrow">Guest preview</Text>
            <View style={styles.row}>
              <View style={styles.liveDot} />
              <Text variant="caption" color="muted">
                Updates guests live
              </Text>
            </View>
          </View>
          <View style={styles.previewCover}>
            {event.coverUrl && <Image source={{ uri: event.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />}
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']} locations={[0.3, 1]} style={StyleSheet.absoluteFill} />
            <View style={styles.previewBadge}>
              <EventBadge event={event} size={40} />
            </View>
            <View style={styles.previewText}>
              {event.startsAt && (
                <Text variant="eyebrow" style={styles.previewDate}>
                  {longDate(event.startsAt)}
                </Text>
              )}
              <Text variant="h1" numberOfLines={2} style={styles.white}>
                {event.name}
              </Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.fakeCta}>
              <Camera size={15} color={colors.onPrimary} />
              <Text variant="label" style={{ color: colors.onPrimary }}>
                Open camera
              </Text>
            </View>
            <View style={styles.fakeSquare}>
              <Images size={16} color={colors.ink} />
            </View>
          </View>
        </View>

        <Section title="Logo" caption="On the join screen, app header and table card. Without one we use your monogram.">
          <View style={styles.row}>
            <EventBadge event={event} size={58} />
            <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => chooseImage('logo')} style={styles.upload}>
              {busy === 'logo' ? <ActivityIndicator color={colors.ink} /> : <Upload size={16} color={colors.ink} />}
              <Text variant="label">Upload logo</Text>
            </Pressable>
            {event.logoUrl && (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => save({ logoKey: null })}>
                <Text variant="label" color="danger">
                  Remove
                </Text>
              </Pressable>
            )}
          </View>
        </Section>

        <Section title="Cover photo" caption="The big picture on the event’s home and your events. Without one, the newest photo is used.">
          <View style={styles.row}>
            <View style={styles.coverThumb}>{event.posterUrl && <Image source={{ uri: event.posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />}</View>
            <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => chooseImage('poster')} style={styles.upload}>
              {busy === 'poster' ? <ActivityIndicator color={colors.ink} /> : <Upload size={16} color={colors.ink} />}
              <Text variant="label">Upload cover</Text>
            </Pressable>
            {event.posterUrl && (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => save({ posterKey: null })}>
                <Text variant="label" color="danger">
                  Remove
                </Text>
              </Pressable>
            )}
          </View>
        </Section>

        <Section title="Names">
          {wedding ? (
            <>
              <View style={styles.row}>
                <Field value={names.partner1} placeholder="First name" onChange={(partner1) => setNames((n) => ({ ...n, partner1 }))} onDone={saveNames} />
                <Field value={names.partner2} placeholder="Second name" onChange={(partner2) => setNames((n) => ({ ...n, partner2 }))} onDone={saveNames} />
              </View>
              <View style={styles.row}>
                <Text variant="label" style={{ color: colors.accent }}>
                  Joined by
                </Text>
                <View style={styles.joiners}>
                  {NAME_JOINERS.map((j) => (
                    <Pressable
                      key={j}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: event.joiner === j }}
                      onPress={() => save({ joiner: j })}
                      style={[styles.joiner, event.joiner === j && styles.joinerOn]}>
                      <Text style={{ fontFamily: fonts.serif, fontSize: 16, color: event.joiner === j ? colors.onPrimary : colors.ink }}>{j}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </>
          ) : (
            <>
              <Field value={names.name} placeholder="Event name" onChange={(name) => setNames((n) => ({ ...n, name }))} onDone={saveNames} />
              <Field
                value={names.organizer}
                placeholder="Company or host"
                onChange={(organizer) => setNames((n) => ({ ...n, organizer }))}
                onDone={saveNames}
              />
            </>
          )}
          <Text variant="label" style={{ color: colors.accent }}>
            Welcome note
          </Text>
          <Field value={names.tagline} placeholder="A line for your guests" onChange={(tagline) => setNames((n) => ({ ...n, tagline }))} onDone={saveNames} />
        </Section>

        <Section title="Name font" caption="Used for names and headings across the guest app.">
          <FontGrid value={theme.fonts} name={event.name} onChange={(fonts) => setTheme({ fonts })} />
        </Section>

        <Section title="Colour theme">
          <ThemeGrid
            value={theme.preset}
            onChange={(preset) => {
              setHex('');
              setTheme({ preset, accent: null });
            }}
          />
          <View style={styles.spread}>
            <Text variant="label" style={{ color: colors.accent }}>
              Accent
            </Text>
            {theme.accent && (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => {
                  setHex('');
                  setTheme({ accent: null });
                }}>
                <Text variant="label" style={{ color: colors.primaryText }}>
                  Use theme accent
                </Text>
              </Pressable>
            )}
          </View>
          <View style={styles.swatches}>
            {THEME_ACCENTS.map((c) => {
              const selected = theme.accent === c;
              return (
                <Pressable
                  key={c}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Accent ${c}`}
                  onPress={() => {
                    setHex(c);
                    setTheme({ accent: c });
                  }}
                  style={[styles.ring, selected && styles.ringOn]}>
                  <View style={[styles.swatch, { backgroundColor: c }]}>{selected && <Check size={icon.sm} color={colors.white} />}</View>
                </Pressable>
              );
            })}
          </View>
          <Field value={hex} placeholder="Or your own colour, e.g. #A2475E" onChange={typeHex} autoCapitalize="characters" maxLength={7} />
        </Section>

        <Section title="Poster frame" caption="Around the event’s cover on your events and the poster.">
          <Segmented
            accessibilityLabel="Poster frame"
            options={POSTER_FRAMES.map((f) => ({ value: f, label: POSTER_FRAME_LABEL[f] }))}
            value={theme.frame}
            onChange={(frame) => setTheme({ frame })}
          />
        </Section>

        <Section title="Photo look" caption="A shared film style for every camera at the event. Originals stay untouched.">
          <View style={styles.grid4}>
            {PHOTO_FILTERS.map((f) => {
              const selected = event.filter === f;
              return (
                <Pressable
                  key={f}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${FILTER_LABEL[f]} look`}
                  onPress={() => save({ filter: f })}
                  style={styles.quarter}>
                  <View style={[styles.filterTile, selected && styles.filterOn]}>
                    {sample && <Image source={{ uri: sample }} style={StyleSheet.absoluteFill} contentFit="cover" />}
                  </View>
                  <Text variant="caption" align="center" style={selected && { fontFamily: fonts.sansSemiBold }}>
                    {FILTER_LABEL[f]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <View style={styles.stampRow}>
          <View style={styles.flex}>
            <Text variant="bodyStrong">Stamp every photo</Text>
            <Text variant="caption" color="muted">
              Adds <Text style={{ fontFamily: fonts.mono, fontSize: 11.5 }}>{stampText(event, event.startsAt)}</Text> in the corner.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Stamp every photo"
            value={event.dateStamp}
            onValueChange={(dateStamp) => save({ dateStamp })}
            trackColor={{ true: colors.primaryText, false: colors.lineStrong }}
            thumbColor={colors.surface}
            ios_backgroundColor={colors.lineStrong}
          />
        </View>

        {event.theme && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setHex('');
              save({ theme: null });
            }}
            style={styles.reset}>
            <Text variant="label" style={{ color: colors.accent }}>
              Use eventShare’s look
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, caption, children }: { title: string; caption?: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text variant="bodyStrong">{title}</Text>
        {caption && (
          <Text variant="caption" color="muted">
            {caption}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

type FieldProps = {
  value: string;
  placeholder: string;
  onChange: (text: string) => void;
  onDone?: () => void;
  autoCapitalize?: 'none' | 'characters' | 'words';
  maxLength?: number;
};

function Field({ value, placeholder, onChange, onDone, autoCapitalize = 'words', maxLength = 80 }: FieldProps) {
  const { colors, fonts } = useTheme();
  const styles = useStyles();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      onEndEditing={onDone}
      placeholder={placeholder}
      placeholderTextColor={colors.subtle}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      maxLength={maxLength}
      returnKeyType="done"
      style={[styles.field, { fontFamily: fonts.sans, color: colors.ink }]}
    />
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { padding: screenPadding, paddingTop: space.lg, paddingBottom: space['4xl'], gap: space['2xl'] },
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs },
  white: { color: '#FFFFFF' },
  preview: { borderRadius: 22, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, padding: space.md, gap: space.sm + 2 },
  previewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xs },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3F9A4F' },
  previewCover: { height: 176, borderRadius: radius.lg + 2, overflow: 'hidden', backgroundColor: colors.sage },
  previewBadge: { position: 'absolute', top: space.sm + 2, left: space.sm + 2 },
  previewText: { position: 'absolute', left: 14, right: 14, bottom: space.md, gap: space.xs },
  previewDate: { color: '#FFFFFF', opacity: 0.9, fontSize: 9.5, lineHeight: 12 },
  fakeCta: { flex: 1, height: 40, borderRadius: radius.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  fakeSquare: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  section: { gap: space.sm + 2 },
  sectionHead: { gap: 2 },
  upload: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.field,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  coverThumb: { width: 58, height: 58, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.sage, borderWidth: 1, borderColor: colors.line },
  field: {
    flex: 1,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    fontSize: 15,
  },
  joiners: { flexDirection: 'row', padding: 3, gap: 2, borderRadius: 11, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.lineStrong },
  joiner: { minWidth: 46, height: 32, borderRadius: space.sm, alignItems: 'center', justifyContent: 'center' },
  joinerOn: { backgroundColor: colors.primary },
  grid4: { flexDirection: 'row', gap: space.sm },
  quarter: { flex: 1, gap: 6 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  ring: { padding: 2, borderRadius: radius.full, borderWidth: 2, borderColor: 'transparent' },
  ringOn: { borderColor: colors.ink },
  swatch: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  filterTile: { aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.sage, borderWidth: 2, borderColor: 'transparent' },
  filterOn: { borderColor: colors.primary },
  stampRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: 14, borderRadius: radius.lg + 2, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  reset: { alignItems: 'center', paddingVertical: space.sm },
}));
