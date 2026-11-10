import {
  FRAME_COLORS,
  FRAME_MESSAGE_MAX,
  FRAME_STYLES,
  NAME_JOINERS,
  type EventDetail,
  type FrameStyle,
  type FrameTemplate,
  type EventImageKind,
  type EventTheme,
  type UpdateEventInput,
} from '@eventshare/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Check, Images, Upload } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { toast } from '@/components/toast';
import { LoadingState, Text } from '@/components/ui';
import { radius, screenPadding, space } from '@/constants/theme';
import { EventBadge } from '@/features/events/event-card';
import { frameInk, TemplateFrame } from '@/features/events/frame-templates';
import { HostHeader } from '@/features/events/event-header';
import { AccentPicker, FontGrid, FramePicker, LookPicker, ThemeGrid } from '@/features/events/look-pickers';
import { pickEventImage } from '@/features/events/event-images';
import { longDate, stampText } from '@/features/events/identity';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { FilteredImage } from '@/features/gallery/photo-filters';
import { usePhotos, useUpdateEvent } from '@/services/api/hooks';
import { DEFAULT_EVENT_THEME, makeStyles, ThemeProvider, useEventLook, useTheme } from '@/theme';

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
  const look = useEventLook();
  const [busy, setBusy] = useState<EventImageKind | null>(null);
  const [names, setNames] = useState({
    name: event.name,
    partner1: event.partner1 ?? '',
    partner2: event.partner2 ?? '',
    organizer: event.organizer ?? '',
    tagline: event.tagline ?? '',
  });
  const wedding = event.type === 'wedding';
  const sample = photos.data?.pages[0]?.items[0]?.thumbUrl ?? event.coverUrl;
  // The preview follows the name fields as they're typed, before they're saved.
  const draftName = wedding
    ? `${names.partner1.trim() || event.partner1 || ''} ${event.joiner} ${names.partner2.trim() || event.partner2 || ''}`
    : names.name.trim() || event.name;

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
        const change = kind === 'logo' ? { logoKey: picked.key } : kind === 'poster' ? { posterKey: picked.key } : { frameKey: picked.key };
        update.mutate(change, {
          onSuccess: () =>
            toast(
              kind === 'logo'
                ? 'Logo updated on every guest phone'
                : kind === 'poster'
                  ? 'Cover updated for every guest'
                  : 'Frame added: guests can save photos in it',
            ),
          onError: (e) => Alert.alert(`Couldn't save the ${kind}`, e.message),
        });
      }
    } catch (e) {
      Alert.alert(`Couldn't add the ${kind}`, e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.screen}>
      <HostHeader event={event} title="Design studio" />
      {/* What a guest sees, in the event's look as it is right now. Pinned above the options, so
          every change can be seen as it's made. */}
      <View style={styles.pinned}>
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
          <ThemeProvider theme={look}>
            <GuestPreview event={event} name={draftName} />
          </ThemeProvider>
        </View>
      </View>
      <KeyboardAwareScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" bottomOffset={24}>
        <Section title="Logo" caption="On the join screen, app header and table card. Without one we use your monogram.">
          <View style={styles.row}>
            <ThemeProvider theme={look}>
              <EventBadge event={event} size={58} />
            </ThemeProvider>
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

        <PhotoFrameSection event={event} sample={sample ?? null} busy={busy} onUpload={() => chooseImage('frame')} save={save} />

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
            onChange={(preset) => setTheme({ preset, accent: null })}
          />
          <AccentPicker value={theme.accent} onChange={(accent) => setTheme({ accent })} />
        </Section>

        <Section title="Poster frame" caption="Around the event’s cover on your events and the poster.">
          <FramePicker value={theme.frame} onChange={(frame) => setTheme({ frame })} />
        </Section>

        <Section title="Photo look" caption="A shared film style for every camera at the event. Originals stay untouched.">
          <LookPicker value={event.filter} sample={sample} onChange={(filter) => save({ filter })} />
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
            onPress={() => save({ theme: null })}
            style={styles.reset}>
            <Text variant="label" style={{ color: colors.accent }}>
              Use eventShare’s look
            </Text>
          </Pressable>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

/** What a guest sees, drawn in the event's own look (the screen around it is eventShare's). */
function GuestPreview({ event, name }: { event: EventDetail; name: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <>
      <View style={styles.previewCover}>
        <FilteredImage uri={event.coverUrl} filter={event.posterUrl ? 'natural' : event.filter} style={StyleSheet.absoluteFill} />
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
            {name}
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
    </>
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
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
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
  white: { color: '#FFFFFF' },
  pinned: { paddingHorizontal: screenPadding, paddingTop: space.sm, paddingBottom: space.md, backgroundColor: colors.paper, borderBottomWidth: 0.5, borderBottomColor: colors.line },
  preview: { borderRadius: 20, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, padding: space.sm + 2, gap: space.sm },
  previewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xs },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3F9A4F' },
  // Kept short: it stays on screen above the options.
  previewCover: { height: 146, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.sage },
  previewBadge: { position: 'absolute', top: space.sm + 2, left: space.sm + 2 },
  previewText: { position: 'absolute', left: 14, right: 14, bottom: space.md, gap: space.xs },
  previewDate: { color: '#FFFFFF', opacity: 0.9, fontSize: 9.5, lineHeight: 12 },
  fakeCta: { flex: 1, height: 36, borderRadius: radius.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  fakeSquare: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
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
  stampRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: 14, borderRadius: radius.lg + 2, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  reset: { alignItems: 'center', paddingVertical: space.sm },
  frameCards: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm + 2 },
  frameCard: { alignItems: 'center', gap: space.xs },
  frameThumb: {
    width: 58,
    height: 76,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.line,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.field,
  },
  frameThumbOn: { borderColor: colors.primary },
  frameEdit: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
  framePreview: { borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  frameControls: { flex: 1, gap: space.sm },
  frameSwatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  frameSwatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  frameSwatchOn: { borderWidth: 3, borderColor: colors.primary },
}));

const FRAME_STYLE_LABEL: Record<FrameStyle, string> = { polaroid: 'Polaroid', classic: 'Classic', band: 'Band', confetti: 'Confetti' };

/**
 * The frame guests can save photos in: a ready-made one (style, colour, message, logo) or the
 * host's own upload. One at a time; picking one replaces the other.
 */
function PhotoFrameSection({
  event,
  sample,
  busy,
  onUpload,
  save,
}: {
  event: EventDetail;
  sample: string | null;
  busy: EventImageKind | null;
  onUpload: () => void;
  save: (change: UpdateEventInput) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const tpl = event.frameTemplate;
  const [message, setMessage] = useState(tpl?.message ?? event.name);
  // The message field follows a change made elsewhere (another phone, or a reset).
  const [lastMessage, setLastMessage] = useState(tpl?.message);
  if (tpl?.message !== lastMessage) {
    setLastMessage(tpl?.message);
    if (tpl) setMessage(tpl.message);
  }

  function setTemplate(change: Partial<FrameTemplate>) {
    const base: FrameTemplate = tpl ?? { style: 'polaroid', color: FRAME_COLORS[0], message: message.trim(), logo: Boolean(event.logoUrl) };
    save({ frameTemplate: { ...base, ...change } });
  }

  const none = !tpl && !event.frameUrl;
  const card = (key: string, label: string, selected: boolean, onPress: () => void, body: React.ReactNode) => (
    <Pressable key={key} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={`${label} frame`} onPress={onPress} style={styles.frameCard}>
      <View style={[styles.frameThumb, selected && styles.frameThumbOn]}>{body}</View>
      <Text variant="caption" style={{ color: selected ? colors.ink : colors.muted }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <Section title="Photo frame" caption="When guests save a photo, they can keep it inside this frame. Pick one and make it yours, or upload your own design.">
      <View style={styles.frameCards}>
        {card('none', 'None', none, () => save({ frameTemplate: null, frameKey: null }), <Text variant="caption" color="muted">None</Text>)}
        {FRAME_STYLES.map((style) =>
          card(
            style,
            FRAME_STYLE_LABEL[style],
            tpl?.style === style,
            () => setTemplate({ style }),
            <TemplateFrame template={{ ...(tpl ?? { color: FRAME_COLORS[0], message: '', logo: false }), style, message: '' }} uri={sample} logoUrl={null} width={54} />,
          ),
        )}
        {event.frameUrl &&
          card(
            'upload',
            'Yours',
            true,
            () => undefined,
            <>
              {sample && <Image source={{ uri: sample }} style={StyleSheet.absoluteFill} contentFit="cover" />}
              <Image source={{ uri: event.frameUrl }} style={StyleSheet.absoluteFill} contentFit="fill" />
            </>,
          )}
      </View>

      {tpl && (
        <View style={styles.frameEdit}>
          <View style={styles.framePreview}>
            <TemplateFrame template={{ ...tpl, message: message.trim() }} uri={sample} logoUrl={event.logoUrl} width={150} />
          </View>
          <View style={styles.frameControls}>
            <Text variant="label" style={{ color: colors.accent }}>
              Colour
            </Text>
            <View style={styles.frameSwatches}>
              {FRAME_COLORS.map((c) => {
                const selected = tpl.color === c;
                return (
                  <Pressable
                    key={c}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Frame colour ${c}`}
                    onPress={() => setTemplate({ color: c })}
                    style={[styles.frameSwatch, { backgroundColor: c }, selected && styles.frameSwatchOn]}>
                    {selected && <Check size={14} color={frameInk(c)} />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {tpl && (
        <>
          <Field
            value={message}
            placeholder="A message, e.g. Tanya & Paul · 12.12.2026"
            autoCapitalize="sentences"
            maxLength={FRAME_MESSAGE_MAX}
            onChange={setMessage}
            onDone={() => message.trim() !== tpl.message && setTemplate({ message: message.trim() })}
          />
          <View style={styles.stampRow}>
            <View style={styles.flex}>
              <Text variant="bodyStrong">Show the logo</Text>
              <Text variant="caption" color="muted">
                {event.logoUrl ? 'Your logo next to the message.' : 'Add a logo above to show it on the frame.'}
              </Text>
            </View>
            <Switch
              accessibilityLabel="Show the logo on the frame"
              disabled={!event.logoUrl}
              value={tpl.logo && Boolean(event.logoUrl)}
              onValueChange={(logo) => setTemplate({ logo })}
              trackColor={{ true: colors.primaryText, false: colors.lineStrong }}
              thumbColor={colors.surface}
              ios_backgroundColor={colors.lineStrong}
            />
          </View>
        </>
      )}

      <View style={styles.row}>
        <Pressable accessibilityRole="button" disabled={busy !== null} onPress={onUpload} style={styles.upload}>
          {busy === 'frame' ? <ActivityIndicator color={colors.ink} /> : <Upload size={16} color={colors.ink} />}
          <Text variant="label">{event.frameUrl ? 'Change your frame' : 'Upload your own'}</Text>
        </Pressable>
        {event.frameUrl && (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => save({ frameKey: null })}>
            <Text variant="label" color="danger">
              Remove
            </Text>
          </Pressable>
        )}
      </View>
      <Text variant="caption" color="muted">
        Your own: a PNG with a see-through window, best at 1800 × 2400.
      </Text>
    </Section>
  );
}
