import { router } from 'expo-router';
import { Plus, ScanLine } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Button, Header, Text } from '@/components/ui';
import { colors, radius, screenPadding, space } from '@/constants/theme';
import { EventPoster } from '@/features/events/event-poster';
import { useEvents, useMe } from '@/services/api/hooks';
import { setCurrentEvent, useCurrentEventId } from '@/store/current-event';

/** How many events Home shows before "See all". */
const RECENT = 4;

function pairs<T>(items: T[]) {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return rows;
}

/** Home: the events you're part of, then join or create one. Picking one opens its album. */
export default function Home() {
  const events = useEvents();
  const me = useMe();
  const currentId = useCurrentEventId();
  const [showAll, setShowAll] = useState(false);
  const list = events.data ?? [];
  const shown = showAll ? list : list.slice(0, RECENT);

  function open(id: string) {
    setCurrentEvent(id);
    router.navigate('/(tabs)/album');
  }

  return (
    <View style={styles.screen}>
      <Header
        right={
          <Pressable accessibilityLabel="More" onPress={() => router.navigate('/(tabs)/more')}>
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
              Be there.{'\n'}
              <Text variant="h1" emphasis color="viewfinderAccent">
                Keep all of it.
              </Text>
            </Text>
            <Text style={{ color: colors.viewfinderText, opacity: 0.8 }}>
              Everyone at your event takes photos, and they all land in one gallery for everyone.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.intro}>
              <Text variant="eyebrow">Your events</Text>
              <Text variant="h1">
                Every event, <Text variant="h1" emphasis>kept together.</Text>
              </Text>
            </View>
            <View style={styles.posters}>
              {pairs(shown).map((row) => (
                <View key={row[0].id} style={styles.row}>
                  {row.map((e) => (
                    <EventPoster key={e.id} event={e} current={e.id === currentId} onPress={() => open(e.id)} />
                  ))}
                  {row.length === 1 && <View style={styles.flex} />}
                </View>
              ))}
            </View>
            {list.length > RECENT && (
              <Button
                label={showAll ? 'Show fewer' : `See all ${list.length} events`}
                variant="ghost"
                fullWidth
                onPress={() => setShowAll((v) => !v)}
              />
            )}
          </>
        )}

        <View style={styles.actions}>
          <Button label="Join an event" leadingIcon={ScanLine} fullWidth onPress={() => router.push('/join')} />
          <Button label="Create an event" leadingIcon={Plus} variant="secondary" fullWidth onPress={() => router.push('/create-event')} />
          <Text variant="caption" color="subtle" align="center">
            Got a code or a QR from your host? Join with it.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: screenPadding, paddingBottom: space['4xl'], gap: space.lg },
  intro: { gap: space.sm, paddingTop: space.sm },
  posters: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  welcome: {
    minHeight: 360,
    justifyContent: 'flex-end',
    gap: space.md,
    padding: space['2xl'],
    borderRadius: radius.xl,
    backgroundColor: colors.viewfinder,
  },
  actions: { gap: space.md, marginTop: space.sm },
});
