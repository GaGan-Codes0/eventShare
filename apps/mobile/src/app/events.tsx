import type { EventSummary } from '@eventshare/shared';
import { router } from 'expo-router';
import { ArrowRight, CalendarDays, Download, Palette, Plus, QrCode, ScanLine, type LucideIcon } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Header, Text } from '@/components/ui';
import { FocusStatusBar } from '@/components/focus-status-bar';
import { screenPadding, space } from '@/constants/theme';
import { EventCard } from '@/features/events/event-card';
import { openEvent } from '@/features/events/open-event';
import { EventRow } from '@/features/home/event-row';
import { BigActionCard, JoinCards } from '@/features/home/join-cards';
import { useEvents, useMe } from '@/services/api/hooks';
import { setShellTab, useShellTab, type ShellTab } from '@/store/shell';
import { makeStyles, themeFor, ThemeProvider, useTheme } from '@/theme';

/**
 * The app outside an event, as in the prototype: Join first (most people who open it are
 * guests), My events, and Host one tab over, so hosting never gets in a guest's way.
 */
export default function Home() {
  const styles = useStyles();
  const me = useMe();
  const tab = useShellTab();
  const events = useEvents();
  const list = events.data ?? [];
  const attending = list.filter((e) => e.role !== 'host');
  const hosting = list.filter((e) => e.role === 'host');
  const open = (e: EventSummary) => openEvent(e.id, e.role);

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
        key={tab}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={events.isRefetching} onRefresh={() => void events.refetch()} />}>
        {tab === 'join' && (
          <>
            <Intro eyebrow={`Hi ${me.data?.name.split(' ')[0] ?? 'there'}`} lead="Join an" emphasis="event." line="Your host shared a QR code or a 6-digit code. Either one gets you in." />
            <JoinCards />
            {/* Right under joining, so it's never below the fold. */}
            <Pressable accessibilityRole="button" onPress={() => router.push('/create-event')} style={styles.hostLink}>
              <Text variant="caption" color="muted" style={styles.hostLinkText}>
                Hosting something? <Text variant="caption" style={styles.hostLinkStrong}>Create an event</Text>
              </Text>
              <ArrowRight size={14} color={styles.hostLinkStrong.color} />
            </Pressable>
            {attending[0] && (
              <View style={styles.group}>
                <Text variant="eyebrow">Pick up where you left off</Text>
                <EventRow event={attending[0]} onPress={() => open(attending[0]!)} />
              </View>
            )}
          </>
        )}

        {tab === 'events' && (
          <>
            <Intro eyebrow="All in one place" lead="My" emphasis="events." line="Everything you’ve joined, and everything you’re hosting." />
            <View style={styles.quick}>
              <QuickAction icon={ScanLine} label="Join an event" onPress={() => setShellTab('join')} />
              <QuickAction icon={Plus} label="Create an event" onPress={() => router.push('/create-event')} />
            </View>
            <Text variant="eyebrow">Attending</Text>
            {attending.length ? (
              <View style={styles.list}>
                {attending.map((e) => (
                  <EventRow key={e.id} event={e} onPress={() => open(e)} />
                ))}
              </View>
            ) : (
              <DashedAction icon={ScanLine} title="Join your first event" caption="Scan a QR code or enter a code" onPress={() => setShellTab('join')} />
            )}
            <View style={styles.spacer} />
            <Text variant="eyebrow">Hosting</Text>
            {hosting.length ? (
              <View style={styles.list}>
                {hosting.map((e) => (
                  <EventRow key={e.id} event={e} onPress={() => open(e)} />
                ))}
              </View>
            ) : (
              <DashedAction icon={Plus} title="Host an event" caption="Your own branded camera for any occasion" onPress={() => setShellTab('host')} />
            )}
          </>
        )}

        {tab === 'host' && (
          <>
            <Intro eyebrow="For hosts" lead="Host an" emphasis="event." line="Brand it, share one code, and every guest’s photos land in your album." />
            <BigActionCard
              icon={Plus}
              title="Create an event"
              caption="Wedding, corporate, birthday. Live in two minutes."
              minHeight={178}
              onPress={() => router.push('/create-event')}
            />
            {hosting.length ? (
              <View style={[styles.group, styles.hostCards]}>
                <Text variant="eyebrow">You’re hosting</Text>
                {hosting.map((e) => (
                  <ThemeProvider key={e.id} theme={themeFor(e.theme)}>
                    <EventCard event={e} onPress={() => open(e)} />
                  </ThemeProvider>
                ))}
              </View>
            ) : (
              <HowTo />
            )}
          </>
        )}
      </ScrollView>
      <ShellTabBar tab={tab} />
    </View>
  );
}

/** Each tab's heading: eyebrow, a serif line with its italic ending, and a sentence. */
function Intro({ eyebrow, lead, emphasis, line }: { eyebrow: string; lead: string; emphasis: string; line: string }) {
  const styles = useStyles();
  return (
    <View style={styles.intro}>
      <Text variant="eyebrow">{eyebrow}</Text>
      <Text variant="h1">
        {lead} <Text variant="h1" emphasis>{emphasis}</Text>
      </Text>
      <Text variant="caption" color="muted" style={styles.introLine}>
        {line}
      </Text>
    </View>
  );
}

/** A compact action at the top of My events. */
function QuickAction({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && { backgroundColor: colors.field }]}>
      <Icon size={17} color={colors.ink} />
      <Text variant="label" style={styles.quickLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

function DashedAction({ icon: Icon, title, caption, onPress }: { icon: LucideIcon; title: string; caption: string; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.dashed, pressed && { backgroundColor: colors.field }]}>
      <View style={styles.dashedIcon}>
        <Icon size={19} color={colors.ink} />
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong" style={styles.dashedTitle}>
          {title}
        </Text>
        <Text variant="caption" color="muted" style={styles.small}>
          {caption}
        </Text>
      </View>
    </Pressable>
  );
}

const HOW_TO: { icon: LucideIcon; title: string; caption: string }[] = [
  { icon: Palette, title: 'Make it yours', caption: 'Logo, colours and a font for the names' },
  { icon: QrCode, title: 'Share one code', caption: 'A QR table card and a 6-digit code' },
  { icon: Download, title: 'Keep everything', caption: 'Every photo, full quality, in one download' },
];

/** Host tab before your first event: what hosting gets you. */
function HowTo() {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.howTo}>
      {HOW_TO.map(({ icon: Icon, title, caption }, i) => (
        <View key={title} style={[styles.howRow, i < HOW_TO.length - 1 && styles.howDivider]}>
          <View style={styles.howIcon}>
            <Icon size={18} color={colors.ink} />
          </View>
          <View style={styles.flex}>
            <Text variant="bodyStrong" style={styles.howTitle}>
              {title}
            </Text>
            <Text variant="caption" color="muted" style={styles.small}>
              {caption}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const SHELL_TABS: { key: ShellTab; label: string; icon: LucideIcon }[] = [
  { key: 'join', label: 'Join', icon: ScanLine },
  { key: 'events', label: 'My events', icon: CalendarDays },
  { key: 'host', label: 'Host', icon: Plus },
];

/** Join · My events · Host, as in the prototype's bar. */
function ShellTabBar({ tab }: { tab: ShellTab }) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 22) }]}>
      {SHELL_TABS.map(({ key, label, icon: Icon }) => {
        const on = tab === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label}
            onPress={() => setShellTab(key)}
            style={styles.tab}>
            <Icon size={22} color={on ? INK : SUBTLE} />
            <Text style={[styles.tabLabel, { color: on ? INK : SUBTLE }]}>{label}</Text>
            <View style={[styles.tabDot, { backgroundColor: on ? '#748063' : 'transparent' }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const INK = '#273C32';
const SUBTLE = '#9A9D8A';

const useStyles = makeStyles(({ colors, fonts }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { paddingHorizontal: screenPadding, paddingTop: 14, paddingBottom: 28, gap: 14, flexGrow: 1 },
  intro: { gap: 6, marginBottom: space.xs },
  introLine: { fontSize: 13.5, lineHeight: 19 },
  group: { gap: 10, marginTop: 6 },
  hostCards: { gap: 12 },
  list: { gap: space.sm },
  spacer: { height: 6 },
  flex: { flex: 1, gap: 1 },
  small: { fontSize: 12, lineHeight: 16 },
  hostLink: { paddingVertical: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  hostLinkText: { fontSize: 13.5, lineHeight: 18 },
  hostLinkStrong: { fontFamily: fonts.sansSemiBold, color: colors.primary },
  quick: { flexDirection: 'row', gap: space.sm },
  quickAction: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  quickLabel: { fontFamily: fonts.sansSemiBold, color: colors.ink },
  dashed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C9CCBE',
  },
  dashedIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  dashedTitle: { fontSize: 14.5, lineHeight: 19 },
  howTo: { borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  howDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  howIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  howTitle: { fontSize: 14, lineHeight: 18 },
  bar: { flexDirection: 'row', backgroundColor: '#FDFCF8', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DEDFD3', paddingTop: 8, paddingHorizontal: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
  tabLabel: { fontFamily: fonts.sansMedium, fontSize: 10.5, lineHeight: 13 },
  tabDot: { width: 4, height: 4, borderRadius: 2 },
}));
