import {
  GUEST_PHOTO_LIMITS,
  PHOTOGRAPHER_PHOTO_LIMIT,
  type EventDetail,
  type GuestPhotoLimit,
  type UpdateEventInput,
} from '@eventshare/shared';
import { Aperture, CalendarClock, Download, ImagePlus, ScanFace, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, Switch, View } from 'react-native';

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

/** Host: how many shots guests get, when the album opens, and the event's rules. */
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

  function save(change: UpdateEventInput, done?: string) {
    update.mutate(change, {
      onSuccess: () => done && toast(done),
      onError: (e) => Alert.alert("Couldn't save", e.message),
    });
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
      caption: 'A small monogram and date, like a disposable camera. Guests can hide it on their phone; originals stay clean.',
      icon: CalendarClock,
      on: event.dateStamp,
      change: (on) => ({ dateStamp: on }),
    },
    {
      title: 'Find my photos',
      caption: 'Guests who take a selfie see the photos their face is in. Off deletes everyone’s faceprints.',
      icon: ScanFace,
      on: event.findMyPhotos,
      change: (on) => ({ findMyPhotos: on }),
    },
  ];

  return (
    <View style={styles.screen}>
      <HostHeader event={event} title="Camera & rules" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text variant="bodyStrong">Shots per guest</Text>
        <View style={styles.shots} accessibilityRole="radiogroup" accessibilityLabel="Shots per guest">
          {/* No ∞: every guest gets a roll. Older events that had no limit still show it until changed. */}
          {[...GUEST_PHOTO_LIMITS, ...(event.guestPhotoLimit === null ? [null] : [])].map((n) => {
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
}));
