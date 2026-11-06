import { router } from 'expo-router';
import { Plus, ScanLine, type LucideIcon } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { Avatar, Header, Text } from '@/components/ui';
import { FocusStatusBar } from '@/components/focus-status-bar';
import { icon, radius, screenPadding, space } from '@/constants/theme';
import { EventCard } from '@/features/events/event-card';
import { openEvent } from '@/features/events/open-event';
import { useEvents, useMe } from '@/services/api/hooks';
import { makeStyles, themeFor, ThemeProvider, useTheme } from '@/theme';

/** Where the app opens: the events you host or joined, then create or join one. */
export default function YourEvents() {
  const { colors } = useTheme();
  const styles = useStyles();
  const events = useEvents();
  const me = useMe();
  const list = events.data ?? [];
  const hosting = list.length > 0 && list.every((e) => e.role === 'host');

  return (
    <View style={styles.screen}>
      <FocusStatusBar style="dark" />
      <Header
        right={
          <Pressable accessibilityLabel="Your profile" hitSlop={8} onPress={() => router.push('/profile')}>
            <Avatar name={me.data?.name ?? ''} uri={me.data?.avatarUrl} />
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={events.isRefetching} onRefresh={() => void events.refetch()} />}>
        {list.length === 0 ? (
          <View style={styles.welcome}>
            <Text variant="eyebrow" style={{ color: colors.viewfinderAccent }}>
              A shared camera roll
            </Text>
            <Text variant="h1" style={{ color: colors.viewfinderText }}>
              Every photo,{'\n'}
              <Text variant="h1" emphasis color="viewfinderAccent">
                everyone’s.
              </Text>
            </Text>
            <Text style={{ color: colors.viewfinderText, opacity: 0.8 }}>
              Join an event with its QR code or 6-digit code. Every guest’s shots land in one shared album.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.intro}>
              <Text variant="eyebrow">{hosting ? 'Hosting' : 'Hosting and joined'}</Text>
              <Text variant="h1">
                Your <Text variant="h1" emphasis>events.</Text>
              </Text>
            </View>
            {list.map((e) => (
              <ThemeProvider key={e.id} theme={themeFor(e.theme)}>
                <EventCard event={e} onPress={() => openEvent(e.id, e.role)} />
              </ThemeProvider>
            ))}
          </>
        )}

        {/* Joining comes first: most people opening the app are guests. */}
        <DashedAction icon={ScanLine} title="Join an event" caption="Scan the QR or enter the code from your host." onPress={() => router.push('/join')} />
        <DashedAction
          icon={Plus}
          title="Create a new event"
          caption="Wedding, corporate, birthday. Live in two minutes."
          onPress={() => router.push('/create-event')}
        />
      </ScrollView>
    </View>
  );
}

function DashedAction({ icon: Icon, title, caption, onPress }: { icon: LucideIcon; title: string; caption: string; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.dashed, pressed && { backgroundColor: colors.field }]}>
      <View style={styles.dashedIcon}>
        <Icon size={icon.lg} color={colors.onPrimary} strokeWidth={icon.stroke} />
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" color="muted">
          {caption}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { padding: screenPadding, paddingTop: space.md, paddingBottom: space['4xl'], gap: space.lg - 2 },
  intro: { gap: 6, marginBottom: 2 },
  welcome: {
    minHeight: 320,
    justifyContent: 'flex-end',
    gap: space.md,
    padding: space['2xl'],
    borderRadius: radius.xl,
    backgroundColor: colors.viewfinder,
  },
  dashed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg - 2,
    paddingVertical: space.lg + 2,
    paddingHorizontal: space.lg,
    borderRadius: radius.xl + 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
  },
  dashedIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
}));
