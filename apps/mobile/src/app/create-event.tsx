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
  type RevealMode,
  type ThemePreset,
} from '@eventshare/shared';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Aperture, ArrowRight, Briefcase, Cake, Camera, ChevronLeft, Heart, ImagePlus, Sparkles, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toast } from '@/components/toast';
import { Text } from '@/components/ui';
import { FocusStatusBar } from '@/components/focus-status-bar';
import { radius, screenPadding, space } from '@/constants/theme';
import { uploadEventImage } from '@/features/events/event-images';
import { longDate, monogram } from '@/features/events/identity';
import { FontGrid, opensAt, RevealOptions, ThemeGrid } from '@/features/events/look-pickers';
import { openEvent } from '@/features/events/open-event';
import { api } from '@/services/api/client';
import { useCreateEvent } from '@/services/api/hooks';
import { defaultTheme, makeStyles, themeFor, ThemeProvider, useTheme } from '@/theme';

const TYPES: { value: EventType; label: string; hint: string; icon: LucideIcon }[] = [
  { value: 'wedding', label: 'Wedding', hint: 'Two names, one shared roll', icon: Heart },
  { value: 'corporate', label: 'Corporate', hint: 'Summits, offsites, launches', icon: Briefcase },
  { value: 'birthday', label: 'Birthday', hint: 'Milestones and parties', icon: Cake },
  { value: 'other', label: 'Something else', hint: 'Reunions, festivals, trips', icon: Sparkles },
];

/** Each kind of event starts with a fitting look, shot list and welcome line; all can be changed. */
const TYPE_DEFAULTS: Record<EventType, { theme: ThemePreset; font: FontPairing; prompts: string[]; tagline: string; titlePh: string }> = {
  wedding: {
    theme: 'sage',
    font: 'romantic',
    prompts: ['The first look', 'Happy tears', 'The dance floor', 'Your table'],
    tagline: 'Thank you for being here. Shoot everything.',
    titlePh: '',
  },
  corporate: {
    theme: 'navy',
    font: 'modern',
    prompts: ['Keynote moment', 'Your team', 'Best booth'],
    tagline: 'One shared roll for the whole room.',
    titlePh: 'Northwind Summit 2026',
  },
  birthday: { theme: 'blush', font: 'bold', prompts: ['The cake', 'Big laughs', 'Group photo'], tagline: 'Catch the chaos.', titlePh: 'Kabir turns 30' },
  other: { theme: 'marigold', font: 'classic', prompts: ['Group photo', 'Best moment'], tagline: 'Every photo, everyone’s.', titlePh: 'Goa reunion' },
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
  theme: ThemePreset;
  font: FontPairing;
  logoUri: string | null;
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
    theme: 'sage',
    font: 'romantic',
    logoUri: null,
    shots: DEFAULT_GUEST_PHOTO_LIMIT,
    reveal: 'live',
  });
  const set = (change: Partial<Wizard>) => setW((v) => ({ ...v, ...change }));
  const wedding = w.type === 'wedding';
  const display = wedding ? `${w.partner1.trim() || 'Name'} & ${w.partner2.trim() || 'Name'}` : w.title.trim() || 'Your event';
  const theme: EventTheme = { preset: w.theme, accent: null, fonts: w.font, frame: 'none' };

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
    const d = TYPE_DEFAULTS[w.type];
    const input: CreateEventInput = {
      type: w.type,
      ...(wedding ? { partner1: w.partner1.trim(), partner2: w.partner2.trim() } : { name: w.title.trim(), organizer: w.organizer.trim() || null }),
      location: w.venue.trim() || undefined,
      startsAt,
      guestPhotoLimit: w.shots,
      revealMode: w.reveal,
      albumOpensAt: opensAt(w.reveal, startsAt),
      // eventShare's own look stays "no theme", so it follows any future change to the default.
      theme: w.theme === 'sage' && w.font === 'classic' ? null : theme,
      prompts: d.prompts,
      tagline: d.tagline,
    };
    create.mutate(input, {
      onSuccess: async (event) => {
        if (w.logoUri) await addLogo(event.id, w.logoUri);
        router.dismissAll();
        openEvent(event.id, event.role);
        router.push('/invite');
        toast('Your event is live. Share the code');
      },
      onError: (e) => Alert.alert("Couldn't create the event", e.message),
    });
  }

  async function pickLogo() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (!res.canceled) set({ logoUri: res.assets[0].uri });
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
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
                    onPress={() => set({ type: t.value, theme: TYPE_DEFAULTS[t.value].theme, font: TYPE_DEFAULTS[t.value].font })}
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
          </>
        )}

        {step === 2 && (
          <>
            <Heading eyebrow="The look" title="Make it " emphasis="yours." />
            <ThemeProvider theme={themeFor(theme)}>
              <InvitePreview display={display} date={w.date} logoUri={w.logoUri} mono={monogram({ ...namesOf(w), name: display })} />
            </ThemeProvider>
            <Text variant="bodyStrong">Colour theme</Text>
            <ThemeGrid value={w.theme} onChange={(theme) => set({ theme })} />
            <Text variant="bodyStrong">Name font</Text>
            <FontGrid value={w.font} name={display} onChange={(font) => set({ font })} />
            <View style={styles.logoRow}>
              <View style={styles.logoIcon}>
                {w.logoUri ? <Image source={{ uri: w.logoUri }} style={styles.logoImg} contentFit="contain" /> : <ImagePlus size={19} color={defaultTheme.colors.ink} />}
              </View>
              <View style={styles.flex}>
                <Text variant="bodyStrong">Logo</Text>
                <Text variant="caption" color="muted">
                  Optional. We’ll use your monogram.
                </Text>
              </View>
              <Pressable accessibilityRole="button" onPress={w.logoUri ? () => set({ logoUri: null }) : pickLogo} style={styles.small}>
                <Text variant="label" color={w.logoUri ? 'danger' : 'ink'}>
                  {w.logoUri ? 'Remove' : 'Upload'}
                </Text>
              </Pressable>
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <Heading eyebrow="Camera rules" title="Load the " emphasis="film." />
            <Text variant="bodyStrong">Shots per guest</Text>
            <View style={styles.shots}>
              {[...GUEST_PHOTO_LIMITS, null].map((n) => {
                const selected = w.shots === n;
                return (
                  <Pressable
                    key={String(n)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={n === null ? 'No limit' : `${n} shots`}
                    onPress={() => set({ shots: n })}
                    style={[styles.shot, selected && styles.shotOn]}>
                    <Text style={[styles.shotText, selected && { color: defaultTheme.colors.onPrimary }]}>{n === null ? '∞' : n}</Text>
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
      </ScrollView>

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
    </KeyboardAvoidingView>
  );
}

const namesOf = (w: Wizard) => ({
  type: w.type,
  partner1: w.partner1.trim() || 'N',
  partner2: w.partner2.trim() || 'N',
  joiner: '&' as const,
  organizer: w.organizer || null,
});

/** The logo picked before the event exists goes up once it's created. */
async function addLogo(eventId: string, uri: string) {
  try {
    const { key } = await uploadEventImage(eventId, 'logo', uri);
    await api(`/events/${eventId}`, { method: 'PATCH', body: { logoKey: key } });
  } catch {
    toast('Event created. Add the logo again from Design');
  }
}

/** What guests will see when they open the invite, in the chosen look. */
function InvitePreview({ display, date, logoUri, mono }: { display: string; date: Date; logoUri: string | null; mono: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.preview, { backgroundColor: colors.paper, borderColor: colors.line }]}>
      <View style={[styles.badge, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {logoUri ? (
          <Image source={{ uri: logoUri }} style={styles.logoImg} contentFit="contain" />
        ) : (
          <Text variant="h3" style={{ color: colors.primaryText, fontSize: 17 }}>
            {mono}
          </Text>
        )}
      </View>
      <Text variant="eyebrow" style={{ color: colors.primaryText }}>
        You’re invited to
      </Text>
      <Text variant="h1" align="center">
        {display}
      </Text>
      <Text variant="caption" color="muted">
        {longDate(date.toISOString())}
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

function Input({ value, onChange, placeholder }: { value: string; onChange: (t: string) => void; placeholder?: string }) {
  const { colors, fonts } = useTheme();
  const styles = useStyles();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.subtle}
      autoCapitalize="words"
      maxLength={80}
      style={[styles.input, { fontFamily: fonts.sans, color: colors.ink }]}
    />
  );
}

/** The phone's own date picker: inline on iOS, a dialog on Android. */
function DateField({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.input, styles.dateIos]}>
        <DateTimePicker value={value} mode="date" display="compact" onValueChange={(_, d) => onChange(d)} />
      </View>
    );
  }
  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={[styles.input, styles.dateAndroid]}>
        <Text>{longDate(value.toISOString())}</Text>
      </Pressable>
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
    dateIos: { justifyContent: 'center', alignItems: 'flex-start', paddingHorizontal: space.xs },
    dateAndroid: { justifyContent: 'center' },
    preview: { borderRadius: 20, borderWidth: 1, paddingVertical: space.xl, paddingHorizontal: 18, alignItems: 'center', gap: space.sm },
    badge: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    previewCta: { marginTop: 6, height: 38, paddingHorizontal: 18, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: 6 },
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
