import { router, useLocalSearchParams } from 'expo-router';
import { MapPin, Users } from 'lucide-react-native';
import type { EventPreview } from '@eventshare/shared';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Banner, Button, IconTile, Text, TextField } from '@/components/ui';
import { radius, screenPadding, space } from '@/constants/theme';
import { EventLogo } from '@/features/events/event-images';
import { makeStyles, themeFor, ThemeProvider, useTheme } from '@/theme';
import { useJoinEvent, useJoinPreview } from '@/services/api/hooks';
import { openEvent } from '@/features/events/open-event';
import { plural } from '@/utils/format';

/** Join by code. Also opened by invite links: eventshare://join?code=XXXXXXXX */
export default function Join() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(params.code ?? '');
  const normalized = code.replace(/[\s-]/g, '').toUpperCase();
  const preview = useJoinPreview(normalized.length === 8 ? normalized : null);
  const join = useJoinEvent();

  function submit() {
    join.mutate(normalized, {
      onSuccess: (event) => {
        // Close the sheet and go into the event.
        router.dismissAll();
        openEvent(event.id, event.role);
      },
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text variant="eyebrow">Join an event</Text>
      <Text variant="h1">
        You’re <Text variant="h1" emphasis>invited.</Text>
      </Text>
      <Text color="muted">Enter the 8-character code from your host’s invite.</Text>
      <TextField
        label="Event code"
        placeholder="ABCD-2345"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus={!params.code}
        maxLength={9}
        style={styles.codeInput}
        error={preview.isError ? preview.error.message : null}
      />

      {preview.data && (
        <ThemeProvider theme={themeFor(preview.data.theme)}>
          <PreviewCard preview={preview.data} />
        </ThemeProvider>
      )}

      {join.isError && <Banner tone="danger">{join.error.message}</Banner>}
      <Button
        label={preview.data ? `Join ${preview.data.name}` : 'Join event'}
        fullWidth
        disabled={!preview.data}
        loading={join.isPending || preview.isFetching}
        onPress={submit}
        style={styles.cta}
      />
    </ScrollView>
  );
}

/** The event you're about to join, in its host's theme. */
function PreviewCard({ preview }: { preview: EventPreview }) {
  const { colors } = useTheme();
  const styles = usePreviewStyles();
  return (
    <View style={styles.preview}>
      {preview.logoUrl ? <EventLogo uri={preview.logoUrl} size={44} /> : <IconTile icon={Users} />}
      <View style={styles.previewText}>
        <Text variant="h3">{preview.name}</Text>
        <Text variant="caption" color="muted">
          Hosted by {preview.hostName} · {plural(preview.memberCount, 'guest')}
        </Text>
        {preview.location && (
          <View style={styles.row}>
            <MapPin size={14} color={colors.muted} />
            <Text variant="caption" color="muted">
              {preview.location}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const usePreviewStyles = makeStyles(({ colors }) => ({
  preview: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.warm,
  },
  previewText: { flex: 1, gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
}));

const styles = StyleSheet.create({
  body: { padding: screenPadding, paddingTop: space['3xl'], gap: space.sm },
  codeInput: { fontSize: 22, letterSpacing: 4, textAlign: 'center' },
  cta: { marginTop: space.lg },
});
