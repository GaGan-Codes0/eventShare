import {
  DEFAULT_GUEST_PHOTO_LIMIT,
  GUEST_PHOTO_LIMITS,
  MAX_PHOTOGRAPHERS,
  PHOTOGRAPHER_PHOTO_LIMIT,
  type CreateEventInput,
  type EventTheme,
  type EventType,
  type FontPairing,
  type GuestPhotoLimit,
  type PhotoFilter,
  type PosterFrame,
  type RevealMode,
  type ThemePreset,
  type UpdateEventInput,
} from '@eventshare/shared';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Aperture, ArrowRight, Briefcase, Cake, Camera, ChevronLeft, Heart, ImagePlus, Sparkle, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Modal, Platform, Pressable, Switch, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toast } from '@/components/toast';
import { Button, Text } from '@/components/ui';
import { FocusStatusBar } from '@/components/focus-status-bar';
import { radius, screenPadding, space } from '@/constants/theme';
import { EventBadge } from '@/features/events/event-card';
import { uploadEventImage } from '@/features/events/event-images';
import { inviteLine, longDate, stampText } from '@/features/events/identity';
import { AccentPicker, FontGrid, FramePicker, LookPicker, opensAt, RevealOptions, ThemeGrid } from '@/features/events/look-pickers';
import { openEvent } from '@/features/events/open-event';
import { api } from '@/services/api/client';
import { useCreateEvent } from '@/services/api/hooks';
import { defaultTheme, makeStyles, themeFor, ThemeProvider, useTheme } from '@/theme';

const TYPES: { value: EventType; label: string; hint: string; icon: LucideIcon }[] = [
  { value: 'wedding', label: 'Wedding', hint: 'Two names, one shared roll', icon: Heart },
  { value: 'corporate', label: 'Corporate', hint: 'Summits, offsites, launches', icon: Briefcase },
  { value: 'birthday', label: 'Birthday', hint: 'Milestones and parties', icon: Cake },
  { value: 'other', label: 'Something else', hint: 'Reunions, festivals, trips', icon: Sparkle },
];

/** Each kind of event starts with a fitting look, shot list and welcome line; all can be changed. */
const TYPE_DEFAULTS: Record<EventType, { theme: ThemePreset; font: FontPairing; tagline: string; titlePh: string }> = {
  wedding: {
    theme: 'sage',
    font: 'romantic',
    tagline: 'Thank you for being here. Shoot everything.',
    titlePh: '',
  },
  corporate: {
    theme: 'navy',
    font: 'modern',
    tagline: 'One shared roll for the whole room.',
    titlePh: 'Northwind Summit 2026',
  },
  birthday: { theme: 'blush', font: 'bold', tagline: 'Catch the chaos.', titlePh: 'Kabir turns 30' },
  other: { theme: 'marigold', font: 'classic', tagline: 'Every photo, everyone’s.', titlePh: 'Goa reunion' },
};

const SHOT_NOTE =
  'Most event-camera apps give guests 10 to 25 shots, with 25 the usual default. We start at 36, a full roll of film: enough for a long day, few enough to keep every shot intentional.';

type Wizard = {
  type: EventType;
  partner1: string;
  partner2: string;
  title: string;
  organizer: string;
  date: Date;
  venue: string;
  tagline: string;
  theme: ThemePreset;
  accent: string | null;
  font: FontPairing;
  frame: PosterFrame;
  filter: PhotoFilter;
  logoUri: string | null;
  posterUri: string | null;
  dateStamp: boolean;
  shots: GuestPhotoLimit | null;
  reveal: RevealMode;
};

/** New event in four steps: what, who/when/where, the look, the camera rules. */
export default function CreateEvent() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const create = useCreateEvent();
  const [step, setStep] = useState(0);
  const [w, setW] = useState<Wizard>({
    type: 'wedding',
    partner1: '',
    partner2: '',
    title: '',
    organizer: '',
    date: new Date(),
    venue: '',
    tagline: TYPE_DEFAULTS.wedding.tagline,
    theme: 'sage',
    accent: null,
    font: 'romantic',
    frame: 'none',
    filter: 'natural',
    logoUri: null,
    posterUri: null,
    dateStamp: true,
    shots: DEFAULT_GUEST_PHOTO_LIMIT,
    reveal: 'live',
  });
  const set = (change: Partial<Wizard>) => setW((v) => ({ ...v, ...change }));
  const wedding = w.type === 'wedding';
  const display = wedding ? `${w.partner1.trim() || 'Name'} & ${w.partner2.trim() || 'Name'}` : w.title.trim() || 'Your event';
  const theme: EventTheme = { preset: w.theme, accent: w.accent, fonts: w.font, frame: w.frame };

  function back() {
    if (step === 0) router.back();
    else setStep(step - 1);
  }

  function next() {
    if (step === 1) {
      const ok = wedding ? w.partner1.trim() && w.partner2.trim() : w.title.trim().length >= 2;
      if (!ok) return toast(wedding ? 'Add both names to continue' : 'Give your event a name');
    }
    if (step < 3) return setStep(step + 1);
    submit();
  }

  function submit() {
    const startsAt = new Date(w.date.getFullYear(), w.date.getMonth(), w.date.getDate(), 12).toISOString();
    const input: CreateEventInput = {
      type: w.type,
      ...(wedding ? { partner1: w.partner1.trim(), partner2: w.partner2.trim() } : { name: w.title.trim(), organizer: w.organizer.trim() || null }),
      location: w.venue.trim() || undefined,
      startsAt,
      guestPhotoLimit: w.shots,
      revealMode: w.reveal,
      albumOpensAt: opensAt(w.reveal, startsAt),
      // eventShare's own look stays "no theme", so it follows any future change to the default.
      theme: w.theme === 'sage' && w.font === 'classic' && !w.accent && w.frame === 'none' ? null : theme,
      tagline: w.tagline.trim() || null,
    };
    create.mutate(input, {
      onSuccess: async (event) => {
        await finishLook(event.id, w);
        router.dismissAll();
        openEvent(event.id, event.role);
        router.push('/invite');
        toast('Your event is live. Share the code');
      },
      onError: (e) => Alert.alert("Couldn't create the event", e.message),
    });
  }

  async function pick(kind: 'logo' | 'poster') {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: kind === 'logo' ? [1, 1] : [9, 10], quality: 1 });
    if (!res.canceled) set(kind === 'logo' ? { logoUri: res.assets[0].uri } : { posterUri: res.assets[0].uri });
  }

  return (
    <View style={styles.screen}>
      <FocusStatusBar style="dark" />
      <View style={[styles.top, { paddingTop: insets.top }]}>
        <View style={styles.topRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={step === 0 ? 'Close' : 'Back'} hitSlop={10} onPress={back} style={styles.backBtn}>
            <ChevronLeft size={22} color={defaultTheme.colors.ink} />
          </Pressable>
          <Text variant="title" style={styles.flex}>
            New event
          </Text>
          <Text variant="mono" style={{ color: defaultTheme.colors.accent }}>
            {step + 1} / 4
          </Text>
        </View>
        <View style={styles.segs}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.seg, i <= step && styles.segOn]} />
          ))}
        </View>
      </View>

      {/* The look step keeps a preview on screen while the options scroll beneath it. */}
      {step === 2 && (
        <View style={styles.pinned}>
          <ThemeProvider theme={themeFor(theme)}>
            <LookPreview w={w} display={display} />
          </ThemeProvider>
        </View>
      )}
      <KeyboardAwareScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" bottomOffset={24}>
        {step === 0 && (
          <>
            <Heading eyebrow="Let’s set it up" title="What are you " emphasis="celebrating?" />
            <View style={styles.types}>
              {TYPES.map((t) => {
                const selected = w.type === t.value;
                return (
                  <Pressable
                    key={t.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() =>
                      set({
                        type: t.value,
                        theme: TYPE_DEFAULTS[t.value].theme,
                        font: TYPE_DEFAULTS[t.value].font,
                        // Their own words stay; the suggested line follows the kind of event.
                        ...(w.tagline === TYPE_DEFAULTS[w.type].tagline && { tagline: TYPE_DEFAULTS[t.value].tagline }),
                      })
                    }
                    style={[styles.type, selected && styles.typeOn]}>
                    <View style={styles.typeIcon}>
                      <t.icon size={19} color={defaultTheme.colors.ink} />
                    </View>
                    <View style={styles.gap2}>
                      <Text variant="bodyStrong">{t.label}</Text>
                      <Text variant="caption" color="muted">
                        {t.hint}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {step === 1 && (
          <>
            <Heading eyebrow="Details" title="Who, when, " emphasis="where." caption="Guests see this the moment they join." />
            {wedding ? (
              <View style={styles.pair}>
                <Labeled label="First name" style={styles.flex}>
                  <Input value={w.partner1} onChange={(partner1) => set({ partner1 })} placeholder="Tanya" />
                </Labeled>
                <Labeled label="Second name" style={styles.flex}>
                  <Input value={w.partner2} onChange={(partner2) => set({ partner2 })} placeholder="Paul" />
                </Labeled>
              </View>
            ) : (
              <>
                <Labeled label="Event name">
                  <Input value={w.title} onChange={(title) => set({ title })} placeholder={TYPE_DEFAULTS[w.type].titlePh} />
                </Labeled>
                <Labeled label={w.type === 'corporate' ? 'Company or team' : 'Hosted by'}>
                  <Input value={w.organizer} onChange={(organizer) => set({ organizer })} placeholder={w.type === 'corporate' ? 'Northwind Labs' : 'Your name'} />
                </Labeled>
              </>
            )}
            <Labeled label="Date">
              <DateField value={w.date} onChange={(date) => set({ date })} />
            </Labeled>
            <Labeled label="Venue">
              <Input value={w.venue} onChange={(venue) => set({ venue })} placeholder="Where’s it happening?" />
            </Labeled>
            <Labeled label="Welcome note">
              <Input value={w.tagline} onChange={(tagline) => set({ tagline })} placeholder="A line for your guests" capitalize="sentences" maxLength={200} />
            </Labeled>
          </>
        )}

        {step === 2 && (
          <>
            <Heading eyebrow="The look" title="Make it " emphasis="yours." caption="Everything here can be changed later in Design." />
            <Text variant="bodyStrong">Colour theme</Text>
            <ThemeGrid value={w.theme} onChange={(preset) => set({ theme: preset, accent: null })} />
            <AccentPicker value={w.accent} onChange={(accent) => set({ accent })} />
            <Text variant="bodyStrong" style={styles.mt}>
              Name font
            </Text>
            <FontGrid value={w.font} name={display} onChange={(font) => set({ font })} />
            <ImageRow title="Logo" caption="Optional. We’ll use your monogram." uri={w.logoUri} contain onPick={() => pick('logo')} onRemove={() => set({ logoUri: null })} />
            <ImageRow
              title="Cover photo"
              caption="Optional. Without one, the newest photo is used."
              uri={w.posterUri}
              onPick={() => pick('poster')}
              onRemove={() => set({ posterUri: null })}
            />
            <Text variant="bodyStrong" style={styles.mt}>
              Poster frame
            </Text>
            <FramePicker value={w.frame} onChange={(frame) => set({ frame })} />
            <View style={styles.gap2}>
              <Text variant="bodyStrong" style={styles.mt}>
                Photo look
              </Text>
              <Text variant="caption" color="muted">
                A shared film style for every camera at the event. Originals stay untouched.
              </Text>
            </View>
            <LookPicker value={w.filter} sample={w.posterUri} onChange={(filter) => set({ filter })} />
            <View style={styles.logoRow}>
              <View style={styles.flex}>
                <Text variant="bodyStrong">Stamp every photo</Text>
                <Text variant="caption" color="muted">
                  Adds <Text style={styles.stamp}>{stampText({ ...namesOf(w), name: display }, w.date.toISOString())}</Text> in the corner. Guests can hide it.
                </Text>
              </View>
              <Switch
                accessibilityLabel="Stamp every photo"
                value={w.dateStamp}
                onValueChange={(dateStamp) => set({ dateStamp })}
                trackColor={{ true: defaultTheme.colors.primaryText, false: defaultTheme.colors.lineStrong }}
                thumbColor={defaultTheme.colors.surface}
                ios_backgroundColor={defaultTheme.colors.lineStrong}
              />
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <Heading eyebrow="Camera rules" title="Load the " emphasis="film." />
            <Text variant="bodyStrong">Shots per guest</Text>
            <View style={styles.shots}>
              {GUEST_PHOTO_LIMITS.map((n) => {
                const selected = w.shots === n;
                return (
                  <Pressable
                    key={String(n)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${n} shots`}
                    onPress={() => set({ shots: n })}
                    style={[styles.shot, selected && styles.shotOn]}>
                    <Text style={[styles.shotText, selected && { color: defaultTheme.colors.onPrimary }]}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text variant="caption" color="muted">
              {SHOT_NOTE}
            </Text>
            <Text variant="bodyStrong" style={styles.mt}>
              When guests see the album
            </Text>
            <RevealOptions value={w.reveal} onChange={(reveal) => set({ reveal })} />
            <View style={styles.note}>
              <View style={styles.noteIcon}>
                <Aperture size={19} color={defaultTheme.colors.ink} />
              </View>
              <View style={styles.flex}>
                <Text variant="bodyStrong">Designated photographers</Text>
                <Text variant="caption" color="muted">
                  Add up to {MAX_PHOTOGRAPHERS} after you create the event. Each gets {PHOTOGRAPHER_PHOTO_LIMIT.toLocaleString('en-US')} uploads and
                  their shots go live instantly.
                </Text>
              </View>
            </View>
          </>
        )}
      </KeyboardAwareScrollView>

      <View style={[styles.foot, { paddingBottom: insets.bottom + space.md }]}>
        <Pressable
          accessibilityRole="button"
          disabled={create.isPending}
          onPress={next}
          style={({ pressed }) => [styles.next, (pressed || create.isPending) && { opacity: 0.85 }]}>
          <Text variant="bodyStrong" style={{ color: defaultTheme.colors.onPrimary }}>
            {create.isPending ? 'Creating…' : step === 3 ? 'Create event' : 'Continue'}
          </Text>
          <ArrowRight size={18} color={defaultTheme.colors.onPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const namesOf = (w: Wizard) => ({
  type: w.type,
  partner1: w.partner1.trim() || 'N',
  partner2: w.partner2.trim() || 'N',
  joiner: '&' as const,
  organizer: w.organizer || null,
});

/**
 * What can only be saved once the event exists: the logo and cover go up, then the photo look
 * and stamp setting (when not the defaults) are saved with them in one go.
 */
async function finishLook(eventId: string, w: Wizard) {
  const change: UpdateEventInput = {};
  const failed: string[] = [];
  for (const [kind, uri] of [
    ['logo', w.logoUri],
    ['poster', w.posterUri],
  ] as const) {
    if (!uri) continue;
    try {
      const { key } = await uploadEventImage(eventId, kind, uri);
      if (kind === 'logo') change.logoKey = key;
      else change.posterKey = key;
    } catch {
      failed.push(kind === 'logo' ? 'logo' : 'cover photo');
    }
  }
  if (w.filter !== 'natural') change.filter = w.filter;
  if (!w.dateStamp) change.dateStamp = false;
  try {
    if (Object.keys(change).length) await api(`/events/${eventId}`, { method: 'PATCH', body: change });
  } catch {
    failed.push('look');
  }
  if (failed.length) toast(`Event created. Add the ${failed.join(' and ')} again from Design`);
}

/** The event as it'll appear on "Your events": cover, frame, badge and name in the chosen look. */
/** What guests see when they open the invite, in the chosen look (the prototype's preview card). */
function LookPreview({ w, display }: { w: Wizard; display: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.preview, { backgroundColor: colors.paper, borderColor: colors.line }]}>
      <EventBadge event={{ ...namesOf(w), name: display, logoUrl: w.logoUri }} size={46} />
      <Text variant="eyebrow" style={{ color: colors.primaryText }}>
        {inviteLine(w.type)}
      </Text>
      <Text variant="h1" align="center" numberOfLines={2}>
        {display}
      </Text>
      <Text variant="caption" color="muted">
        {longDate(w.date.toISOString())}
      </Text>
      <View style={[styles.previewCta, { backgroundColor: colors.primary }]}>
        <Camera size={15} color={colors.onPrimary} />
        <Text variant="label" style={{ color: colors.onPrimary }}>
          Open camera
        </Text>
      </View>
    </View>
  );
}

type ImageRowProps = { title: string; caption: string; uri: string | null; contain?: boolean; onPick: () => void; onRemove: () => void };

function ImageRow({ title, caption, uri, contain, onPick, onRemove }: ImageRowProps) {
  const styles = useStyles();
  return (
    <View style={styles.logoRow}>
      <View style={styles.logoIcon}>
        {uri ? (
          <Image source={{ uri }} style={contain ? styles.logoImg : styles.coverImg} contentFit={contain ? 'contain' : 'cover'} />
        ) : (
          <ImagePlus size={19} color={defaultTheme.colors.ink} />
        )}
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" color="muted">
          {caption}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${uri ? 'Remove' : 'Upload'} ${title.toLowerCase()}`} onPress={uri ? onRemove : onPick} style={styles.small}>
        <Text variant="label" color={uri ? 'danger' : 'ink'}>
          {uri ? 'Remove' : 'Upload'}
        </Text>
      </Pressable>
    </View>
  );
}

function Heading({ eyebrow, title, emphasis, caption }: { eyebrow: string; title: string; emphasis: string; caption?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.heading}>
      <Text variant="eyebrow">{eyebrow}</Text>
      <Text variant="h1">
        {title}
        <Text variant="h1" emphasis>
          {emphasis}
        </Text>
      </Text>
      {caption && (
        <Text variant="caption" color="muted">
          {caption}
        </Text>
      )}
    </View>
  );
}

function Labeled({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  const styles = useStyles();
  return (
    <View style={[styles.labeled, style]}>
      <Text variant="label" color="accent">
        {label}
      </Text>
      {children}
    </View>
  );
}

type InputProps = { value: string; onChange: (t: string) => void; placeholder?: string; capitalize?: 'words' | 'sentences'; maxLength?: number };

function Input({ value, onChange, placeholder, capitalize = 'words', maxLength = 80 }: InputProps) {
  const { colors, fonts } = useTheme();
  const styles = useStyles();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.subtle}
      autoCapitalize={capitalize}
      maxLength={maxLength}
      style={[styles.input, { fontFamily: fonts.sans, color: colors.ink }]}
    />
  );
}

/**
 * The event date. Android uses the phone's own dialog (it has OK and Cancel). iOS shows the calendar
 * in a sheet with Cancel and Save, so it's clear how to finish: the compact picker had no button.
 */
function DateField({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const show = () => {
    setDraft(value);
    setOpen(true);
  };
  const field = (
    <Pressable accessibilityRole="button" accessibilityLabel={`Date, ${longDate(value.toISOString())}`} onPress={show} style={[styles.input, styles.dateField]}>
      <Text>{longDate(value.toISOString())}</Text>
    </Pressable>
  );
  if (Platform.OS !== 'ios') {
    return (
      <>
        {field}
        {open && (
          <DateTimePicker
            value={value}
            mode="date"
            onValueChange={(_, d) => {
              setOpen(false);
              onChange(d);
            }}
            onDismiss={() => setOpen(false)}
          />
        )}
      </>
    );
  }
  return (
    <>
      {field}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.sheetWrap}>
          <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
            <View style={styles.grabber} />
            <Text variant="bodyStrong">Event date</Text>
            <DateTimePicker
              value={draft}
              mode="date"
              display="inline"
              themeVariant="light"
              accentColor={defaultTheme.colors.primary}
              onValueChange={(_, d) => setDraft(d)}
            />
            <View style={styles.sheetButtons}>
              <Button label="Cancel" variant="secondary" onPress={() => setOpen(false)} style={styles.flex1} />
              <Button
                label="Save date"
                onPress={() => {
                  onChange(draft);
                  setOpen(false);
                }}
                style={styles.flex1}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// The wizard is eventShare's own screen (the event has no look yet), apart from the preview.
const useStyles = makeStyles(() => {
  const colors = defaultTheme.colors;
  return {
    screen: { flex: 1, backgroundColor: colors.paper },
    top: { backgroundColor: colors.paper },
    topRow: { height: 54, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: space.sm, paddingRight: screenPadding },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    segs: { flexDirection: 'row', gap: space.xs, paddingHorizontal: screenPadding, paddingBottom: space.xs },
    seg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.lineStrong },
    segOn: { backgroundColor: colors.primary },
    preview: { borderRadius: 20, borderWidth: 1, paddingVertical: space.lg, paddingHorizontal: 18, alignItems: 'center', gap: 6 },
    previewCta: { marginTop: space.xs, height: 36, paddingHorizontal: 18, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: 6 },
    pinned: { paddingHorizontal: screenPadding, paddingTop: space.md, paddingBottom: space.md + 4, borderBottomWidth: 0.5, borderBottomColor: colors.line },
    stamp: { fontFamily: defaultTheme.fonts.mono, fontSize: 11.5 },
    coverImg: { width: '100%', height: '100%' },
    body: { padding: screenPadding, paddingTop: space.xl, paddingBottom: space['2xl'], gap: space.lg - 2 },
    flex: { flex: 1, gap: 2 },
    gap2: { gap: 2 },
    mt: { marginTop: space.xs },
    heading: { gap: 6, marginBottom: space.xs },
    types: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm + 2 },
    type: {
      width: '48.3%',
      minHeight: 136,
      justifyContent: 'space-between',
      gap: space.md,
      padding: space.lg,
      paddingHorizontal: 14,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
    },
    typeOn: { backgroundColor: colors.sage, borderWidth: 2, borderColor: colors.primary },
    typeIcon: {
      width: 38,
      height: 38,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pair: { flexDirection: 'row', gap: space.sm + 2 },
    labeled: { gap: 6 },
    input: {
      height: 46,
      paddingHorizontal: 14,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.lineStrong,
      backgroundColor: colors.surface,
      fontSize: 15,
    },
    dateField: { justifyContent: 'center' },
    sheetWrap: { flex: 1 },
    backdrop: { flex: 1, backgroundColor: colors.overlay },
    sheet: { backgroundColor: colors.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: space.xl, paddingTop: space.sm + 2, gap: space.sm },
    grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, marginBottom: space.xs },
    sheetButtons: { flexDirection: 'row', gap: space.sm + 2 },
    flex1: { flex: 1 },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg + 2, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
    logoIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    logoImg: { width: '76%', height: '76%' },
    small: { height: 36, paddingHorizontal: space.md, borderRadius: 10, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.lineStrong, justifyContent: 'center' },
    shots: { flexDirection: 'row', gap: 6 },
    shot: { flex: 1, height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    shotOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    shotText: { fontFamily: defaultTheme.fonts.mono, fontSize: 16, color: colors.ink },
    note: { flexDirection: 'row', gap: space.md, padding: 14, borderRadius: radius.lg + 2, backgroundColor: colors.warm },
    noteIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.warmDeep, alignItems: 'center', justifyContent: 'center' },
    foot: { paddingHorizontal: screenPadding, paddingTop: space.md, borderTopWidth: 0.5, borderTopColor: colors.line, backgroundColor: colors.paper },
    next: { height: 50, borderRadius: 14, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  };
});
