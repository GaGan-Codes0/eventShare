import type { Member } from '@eventshare/shared';
import { router } from 'expo-router';
import { UserMinus, UserPlus } from 'lucide-react-native';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { Avatar, Button, Header, IconButton, ListRow, LoadingState, Pill, Text } from '@/components/ui';
import { screenPadding, space } from '@/constants/theme';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { useMe, useMembers, useRemoveMember } from '@/services/api/hooks';
import { plural } from '@/utils/format';

export default function People() {
  const { id, event, isHost } = useCurrentEvent();
  const me = useMe();
  const members = useMembers(id);
  const remove = useRemoveMember(id ?? '');

  if (!event || members.isPending) return <LoadingState />;

  function confirmRemove(m: Member) {
    Alert.alert(`Remove ${m.name}?`, "They'll lose access to the album and can't rejoin with the code.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          remove.mutate(m.userId, {
            onSuccess: () => void members.refetch(),
            onError: (e) => Alert.alert("Couldn't remove", e.message),
          }),
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <Header title="People" />
      <FlatList
        data={members.data ?? []}
        keyExtractor={(m) => m.userId}
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={members.isRefetching} onRefresh={() => void members.refetch()} />}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Text variant="eyebrow">{event.name}</Text>
            <Text variant="h1">
              The people <Text variant="h1" emphasis>who were there.</Text>
            </Text>
            <Text variant="caption" color="muted">
              {plural(members.data?.length ?? 0, 'guest')} in this event
            </Text>
            <Button label="Invite people" leadingIcon={UserPlus} fullWidth onPress={() => router.push('/invite')} style={styles.cta} />
          </View>
        }
        renderItem={({ item: m }) => {
          const isMe = m.userId === me.data?.id;
          const canRemove = isHost && m.role !== 'host' && !isMe;
          return (
            <ListRow
              leading={<Avatar name={m.name} uri={m.avatarUrl} size={40} />}
              title={isMe ? `${m.name} (you)` : m.name}
              caption={`Joined ${new Date(m.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
              trailing={
                <View style={styles.trailing}>
                  <Pill label={m.role === 'host' ? 'Host' : 'Guest'} />
                  {canRemove && (
                    <IconButton icon={UserMinus} color="danger" accessibilityLabel={`Remove ${m.name}`} onPress={() => confirmRemove(m)} />
                  )}
                </View>
              }
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingHorizontal: screenPadding, paddingBottom: space['4xl'] },
  intro: { gap: space.sm, paddingTop: space['2xl'], paddingBottom: space.md },
  cta: { marginTop: space.md },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
