import type { EventPreview } from '@eventshare/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { Aperture, ArrowRight, Camera, Images, X, type LucideIcon } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FocusStatusBar } from '@/components/focus-status-bar';
import { Banner, Button, LoadingState, Text } from '@/components/ui';
import { space } from '@/constants/theme';
import { EventBadge } from '@/features/events/event-card';
import { longDate } from '@/features/events/identity';
import { openEvent } from '@/features/events/open-event';
import { useJoinEvent, useJoinPreview, useMe } from '@/services/api/hooks';
import { makeStyles, themeFor, ThemeProvider, useTheme } from '@/theme';

/** "You're invited to …", in the host's look: what you get, then Enter the event. */
export default function JoinPreviewScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const preview = useJoinPreview(code ?? null);
  if (preview.isPending) return <LoadingState />;
  if (preview.isError || !preview.data) return <NotFound message={preview.error?.message ?? 'That code doesn’t match an event'} />;
  return (
    <ThemeProvider theme={themeFor(preview.data.theme)}>
      <Invited code={code} event={preview.data} />
    </ThemeProvider>
  );
}

function Invited({ code, event }: { code: string; event: EventPreview }) {
  const { colors, dark } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const join = useJoinEvent();

  const shots = event.guestPhotoLimit === null ? 'Unlimited shots' : `${event.guestPhotoLimit} shots on your roll`;
  const shooters = event.photographers.length;
  const reveal = { live: 'Photos appear live for everyone', after: 'The album opens when the event ends', morning: 'The album opens next morning, 9 AM' }[
    event.revealMode
  ];
  const rows: { icon: LucideIcon; title: string; caption: string }[] = [
    { icon: Camera, title: shots, caption: 'Your own roll for the event' },
    {
      icon: Aperture,
      title: shooters ? `${shooters} designated photographer${shooters > 1 ? 's' : ''}` : 'Shared by every guest',
      caption: shooters ? `${event.photographers.join(' & ')} ${shooters > 1 ? 'are' : 'is'} covering the whole event` : 'Everyone’s photos land in one album',
    },
    { icon: Images, title: reveal, caption: event.requireReview ? 'Hosts review guest photos first' : 'Full quality, nothing compressed' },
  ];

  function enter() {
    join.mutate(code, {
      onSuccess: (detail) => {
        router.dismissAll();
        openEvent(detail.id, detail.role);
      },
    });
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FocusStatusBar style={dark ? 'light' : 'dark'} />
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.close}>
          <X size={19} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <EventBadge event={event} size={78} />
        <Text variant="eyebrow" style={{ color: colors.primaryText, letterSpacing: 1.8 }}>
          You’re invited to
        </Text>
        <Text variant="display" align="center">
          {event.name}
        </Text>
        <Text variant="caption" color="muted" align="center">
          {[event.startsAt && longDate(event.startsAt), event.location].filter(Boolean).join('\n')}
        </Text>
        {event.tagline && (
          <Text align="center" emphasis style={styles.tagline}>
            “{event.tagline}”
          </Text>
        )}
        <View style={styles.card}>
          {rows.map((r, i) => (
            <View key={r.title} style={[styles.row, i > 0 && styles.divider]}>
              <View style={styles.icon}>
                <r.icon size={18} color={colors.primaryText} />
              </View>
              <View style={styles.flex}>
                <Text variant="bodyStrong">{r.title}</Text>
                <Text variant="caption" color="muted">
                  {r.caption}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={[styles.foot, { paddingBottom: insets.bottom + space.md }]}>
        {join.isError && <Banner tone="danger">{join.error.message}</Banner>}
        <Pressable
          accessibilityRole="button"
          disabled={join.isPending}
          onPress={enter}
          style={({ pressed }) => [styles.enter, (pressed || join.isPending) && { opacity: 0.85 }]}>
          <Text variant="bodyStrong" style={{ color: colors.onPrimary }}>
            {join.isPending ? 'Joining…' : 'Enter the event'}
          </Text>
          <ArrowRight size={18} color={colors.onPrimary} />
        </Pressable>
        {me.data && (
          <Text variant="caption" color="muted" align="center">
            Joining as {me.data.name}
            {me.data.email ? ` · ${me.data.email}` : ''}
          </Text>
        )}
      </View>
    </View>
  );
}

function NotFound({ message }: { message: string }) {
  const styles = useStyles();
  return (
    <View style={[styles.screen, styles.notFound]}>
      <Text variant="h2" align="center">
        We couldn’t find that event
      </Text>
      <Text color="muted" align="center">
        {message}
      </Text>
      <Button label="Try another code" onPress={() => router.replace('/join-code')} />
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  top: { height: 54, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 26, paddingTop: space.xs, paddingBottom: space.lg, alignItems: 'center', gap: space.md },
  tagline: { opacity: 0.85, fontSize: 15, lineHeight: 22 },
  card: { alignSelf: 'stretch', marginTop: 6, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 13, paddingHorizontal: 14 },
  divider: { borderTopWidth: 0.5, borderTopColor: colors.line },
  icon: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 1 },
  foot: { paddingHorizontal: 22, paddingTop: space.md, gap: space.sm },
  enter: { height: 52, borderRadius: 16, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  notFound: { justifyContent: 'center', padding: space['2xl'], gap: space.md },
}));
