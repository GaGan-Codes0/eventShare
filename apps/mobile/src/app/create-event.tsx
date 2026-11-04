import {
  createEventSchema,
  DEFAULT_GUEST_PHOTO_LIMIT,
  GUEST_PHOTO_LIMITS,
  PHOTOGRAPHER_PHOTO_LIMIT,
  type GuestPhotoLimit,
} from '@eventshare/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Banner, Button, Segmented, Text, TextField } from '@/components/ui';
import { screenPadding, space } from '@/constants/theme';
import { useCreateEvent } from '@/services/api/hooks';
import { setCurrentEvent } from '@/store/current-event';

export default function CreateEvent() {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [guestPhotoLimit, setGuestPhotoLimit] = useState<GuestPhotoLimit>(DEFAULT_GUEST_PHOTO_LIMIT);
  const [nameError, setNameError] = useState<string | null>(null);
  const create = useCreateEvent();

  function submit() {
    const parsed = createEventSchema.safeParse({ name, location: location || undefined, guestPhotoLimit });
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message ?? 'Check the name');
      return;
    }
    create.mutate(parsed.data, {
      onSuccess: (event) => {
        setCurrentEvent(event.id);
        // Close the sheet and open the new event's album.
        router.dismissAll();
        router.navigate('/(tabs)/album');
      },
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text variant="eyebrow">New event</Text>
      <Text variant="h1">
        Start a <Text variant="h1" emphasis>shared roll.</Text>
      </Text>
      <Text color="muted">You’ll be the host. Everyone you invite can add photos and see them all.</Text>
      <TextField
        label="Event name"
        placeholder="Riya & Arjun's wedding"
        value={name}
        onChangeText={(t) => {
          setName(t);
          setNameError(null);
        }}
        error={nameError}
        autoFocus
        maxLength={80}
      />
      <TextField label="Where (optional)" placeholder="The Leela Palace, Jaipur" value={location} onChangeText={setLocation} maxLength={120} />
      <View style={styles.limit}>
        <Text variant="label" color="accent">
          Photos per guest
        </Text>
        <Segmented
          accessibilityLabel="Photos per guest"
          options={GUEST_PHOTO_LIMITS.map((n) => ({ value: n, label: String(n) }))}
          value={guestPhotoLimit}
          onChange={setGuestPhotoLimit}
        />
        <Text variant="caption" color="muted">
          Like a disposable camera. A photographer you pick can take up to {PHOTOGRAPHER_PHOTO_LIMIT}. You can change this later.
        </Text>
      </View>
      {create.isError && <Banner tone="danger">{create.error.message}</Banner>}
      <Button label="Create event" fullWidth loading={create.isPending} onPress={submit} style={styles.cta} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: screenPadding, paddingTop: space['3xl'], gap: space.sm },
  cta: { marginTop: space.lg },
  limit: { gap: space.sm, marginTop: space.sm },
});
