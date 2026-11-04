import { PHOTOGRAPHER_PHOTO_LIMIT, type Member } from '@eventshare/shared';
import { router } from 'expo-router';
import { Aperture, UserMinus, UserPlus } from 'lucide-react-native';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { Avatar, Button, Header, IconButton, ListRow, LoadingState, Pill, Text } from '@/components/ui';
import { screenPadding, space } from '@/constants/theme';
import { NoEventYet } from '@/features/events/no-event';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { ROLE_LABEL } from '@/features/events/roles';
import { useMe, useMembers, useRemoveMember, useSetMemberRole } from '@/services/api/hooks';
import { plural } from '@/utils/format';

export default function People() {
  const { id, event, isHost } = useCurrentEvent();
  const me = useMe();
  const members = useMembers(id);
  const remove = useRemoveMember(id ?? '');
  const setRole = useSetMemberRole(id ?? '');

  if (!id) return <NoEventYet title="People" />;
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

  function confirmRole(m: Member) {
    const promote = m.role === 'member';
    Alert.alert(
      promote ? `Make ${m.name} the photographer?` : `Make ${m.name} a guest again?`,
      promote
        ? `They can take up to ${PHOTOGRAPHER_PHOTO_LIMIT} photos and are shown as the Photographer.`
        : `They go back to the guest limit of ${event?.guestPhotoLimit ?? 20} photos. Photos they already took stay.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: promote ? 'Make photographer' : 'Make guest',
          onPress: () =>
            setRole.mutate(
              { userId: m.userId, role: promote ? 'photographer' : 'member' },
              { onError: (e) => Alert.alert("Couldn't change their role", e.message) },
            ),
        },
      ],
    );
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
              {plural(members.data?.length ?? 0, 'person', 'people')} in this event
            </Text>
            <Button label="Invite people" leadingIcon={UserPlus} fullWidth onPress={() => router.push('/invite')} style={styles.cta} />
          </View>
        }
        renderItem={({ item: m }) => {
          const isMe = m.userId === me.data?.id;
          const canManage = isHost && m.role !== 'host' && !isMe;
          return (
            <ListRow
              leading={<Avatar name={m.name} uri={m.avatarUrl} size={40} />}
              title={isMe ? `${m.name} (you)` : m.name}
              caption={`${plural(m.photosUsed, 'photo')} · ${new Date(m.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
              trailing={
                <View style={styles.trailing}>
                  <Pill label={ROLE_LABEL[m.role]} />
                  {canManage && (
                    <IconButton
                      icon={Aperture}
                      accessibilityLabel={m.role === 'photographer' ? `Make ${m.name} a guest` : `Make ${m.name} the photographer`}
                      onPress={() => confirmRole(m)}
                    />
                  )}
                  {canManage && (
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
