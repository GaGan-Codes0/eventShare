import {
  GUEST_PHOTO_LIMITS,
  MAX_PROMPTS,
  PHOTOGRAPHER_PHOTO_LIMIT,
  type EventDetail,
  type GuestPhotoLimit,
  type UpdateEventInput,
} from '@eventshare/shared';
import { Aperture, CalendarClock, Download, ImagePlus, ShieldCheck, X, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';

import { toast } from '@/components/toast';
import { LoadingState, Text } from '@/components/ui';
import { radius, screenPadding, space } from '@/constants/theme';
import { HostHeader } from '@/features/events/event-header';
import { opensAt, RevealOptions } from '@/features/events/look-pickers';
import { NoEventYet } from '@/features/events/no-event';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { useUpdateEvent } from '@/services/api/hooks';
import { makeStyles, useTheme } from '@/theme';

const SHOT_NOTE =
  'Most event-camera apps give guests 10 to 25 shots, with 25 the usual default. We start at 36, a full roll of film: enough for a long day, few enough to keep every shot intentional.';

/** Host: how many shots guests get, when the album opens, the event's rules and its shot list. */
export default function Rules() {
  const { id, event } = useCurrentEvent();
  if (!id) return <NoEventYet title="Rules" />;
  if (!event) return <LoadingState />;
  return <RulesBody event={event} />;
}

function RulesBody({ event }: { event: EventDetail }) {
  const { colors, fonts } = useTheme();
  const styles = useStyles();
  const update = useUpdateEvent(event.id);
  const [newPrompt, setNewPrompt] = useState('');

  function save(change: UpdateEventInput, done?: string) {
    update.mutate(change, {
      onSuccess: () => done && toast(done),
      onError: (e) => Alert.alert("Couldn't save", e.message),
    });
  }

  function addPrompt() {
    const text = newPrompt.trim();
    if (!text) return;
    if (event.prompts.includes(text)) return setNewPrompt('');
    save({ prompts: [...event.prompts, text] });
    setNewPrompt('');
  }

  const rules: { title: string; caption: string; icon: LucideIcon; on: boolean; change: (on: boolean) => UpdateEventInput }[] = [
    {
      title: 'Review guest photos first',
      caption: 'Guest shots wait for your OK. Photographers skip the queue.',
      icon: ShieldCheck,
      on: event.requireReview,
      change: (on) => ({ requireReview: on }),
    },
    {
      title: 'Guests can save photos',
      caption: 'Download originals from the album.',
      icon: Download,
      on: event.allowDownloads,
      change: (on) => ({ allowDownloads: on }),
    },
    {
      title: 'Camera-roll uploads',
      caption: 'Add photos taken earlier. They count toward the roll.',
      icon: ImagePlus,
      on: event.allowLibraryUploads,
      change: (on) => ({ allowLibraryUploads: on }),
    },
    {
      title: 'Date stamp on photos',
      caption: 'A small monogram and date, like a disposable camera. Originals stay clean.',
      icon: CalendarClock,
      on: event.dateStamp,
      change: (on) => ({ dateStamp: on }),
    },
  ];

  return (
    <View style={styles.screen}>
      <HostHeader event={event} title="Camera & rules" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text variant="bodyStrong">Shots per guest</Text>
        <View style={styles.shots} accessibilityRole="radiogroup" accessibilityLabel="Shots per guest">
          {[...GUEST_PHOTO_LIMITS, null].map((n) => {
            const selected = event.guestPhotoLimit === n;
            return (
              <Pressable
                key={String(n)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={n === null ? 'No limit' : `${n} shots`}
                onPress={() => save({ guestPhotoLimit: n as GuestPhotoLimit | null })}
                style={[styles.shot, selected && styles.shotOn]}>
                <Text style={[styles.shotText, { fontFamily: fonts.mono, color: selected ? colors.onPrimary : colors.ink }]}>
                  {n === null ? '∞' : n}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text variant="caption" color="muted">
          {SHOT_NOTE}
          {event.guestPhotoLimit !== null && !(GUEST_PHOTO_LIMITS as readonly number[]).includes(event.guestPhotoLimit)
            ? ` This event is on ${event.guestPhotoLimit}, an older choice.`
            : ''}
        </Text>
        <View style={styles.note}>
          <Aperture size={16} color={colors.ink} />
          <Text variant="caption">Designated photographers: {PHOTOGRAPHER_PHOTO_LIMIT.toLocaleString('en-US')} uploads each</Text>
        </View>

        <Text variant="bodyStrong" style={styles.section}>
          When guests see the album
        </Text>
        <RevealOptions value={event.revealMode} onChange={(mode) => save({ revealMode: mode, albumOpensAt: opensAt(mode, event.startsAt) })} />

        <Text variant="bodyStrong" style={styles.section}>
          Rules
        </Text>
        <View style={styles.group}>
          {rules.map((rule, i) => (
            <View key={rule.title} style={[styles.option, i > 0 && styles.divider]}>
              <rule.icon size={18} color={colors.ink} />
              <View style={styles.flex}>
                <Text variant="bodyStrong">{rule.title}</Text>
                <Text variant="caption" color="muted">
                  {rule.caption}
                </Text>
              </View>
              <Switch
                accessibilityLabel={rule.title}
                value={rule.on}
                onValueChange={(on) => save(rule.change(on))}
                trackColor={{ true: colors.primary, false: colors.lineStrong }}
                thumbColor={colors.surface}
                ios_backgroundColor={colors.lineStrong}
              />
            </View>
          ))}
        </View>

        <Text variant="bodyStrong" style={styles.section}>
          Shot list
        </Text>
        <Text variant="caption" color="muted">
          Prompts guests can shoot for, like “The first look”. Tapping one opens the camera.
        </Text>
        <View style={styles.prompts}>
          {event.prompts.map((p, i) => (
            <View key={p} style={styles.prompt}>
              <Text variant="label">{p}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${p}`}
                hitSlop={8}
                onPress={() => save({ prompts: event.prompts.filter((_, j) => j !== i) })}>
                <X size={14} color={colors.muted} />
              </Pressable>
            </View>
          ))}
        </View>
        {event.prompts.length < MAX_PROMPTS && (
          <View style={styles.addRow}>
            <TextInput
              value={newPrompt}
              onChangeText={setNewPrompt}
              onSubmitEditing={addPrompt}
              placeholder="Add a shot, e.g. Your table"
              placeholderTextColor={colors.subtle}
              returnKeyType="done"
              maxLength={60}
              style={[styles.input, { fontFamily: fonts.sans, color: colors.ink }]}
            />
            <Pressable accessibilityRole="button" onPress={addPrompt} style={styles.add}>
              <Text variant="label" style={{ color: colors.onPrimary }}>
                Add
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { padding: screenPadding, paddingBottom: space['4xl'], gap: space.sm + 2 },
  section: { marginTop: space.lg },
  flex: { flex: 1, gap: 2 },
  shots: { flexDirection: 'row', gap: space.sm },
  shot: { flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  shotOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  shotText: { fontSize: 15 },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.warm },
  group: { borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg - 2 },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  prompts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: space.md, paddingRight: space.sm + 2, paddingVertical: space.sm, borderRadius: radius.full, backgroundColor: colors.sage },
  addRow: { flexDirection: 'row', gap: space.sm },
  input: { flex: 1, height: 44, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.field, fontSize: 15 },
  add: { height: 44, paddingHorizontal: space.lg, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
}));
