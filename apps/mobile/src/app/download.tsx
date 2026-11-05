import type { ArchiveScope } from '@eventshare/shared';
import { Directory, File, Paths } from 'expo-file-system';
import { Check, Download } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, Share, View } from 'react-native';

import { Button, LoadingState, Text } from '@/components/ui';
import { radius, screenPadding, space } from '@/constants/theme';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { requestArchive, useArchiveSummary } from '@/services/api/hooks';
import { makeStyles, ThemeProvider, useCurrentEventTheme, useTheme } from '@/theme';

const CHOICES: { value: ArchiveScope; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'photographers', label: 'Photographers only' },
  { value: 'guests', label: 'Guests only' },
];

function size(bytes: number) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return mb >= 1 ? `${Math.round(mb)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Host: every original, untouched, in one ZIP with a folder per person. */
function DownloadAll() {
  const { colors, fonts } = useTheme();
  const styles = useStyles();
  const { id } = useCurrentEvent();
  const summary = useArchiveSummary(id);
  const [scope, setScope] = useState<ArchiveScope>('all');
  // Stop asking once the sheet is closed; the server keeps packing regardless.
  const open = useRef(true);
  useEffect(
    () => () => {
      open.current = false;
    },
    [],
  );
  const [stage, setStage] = useState<'idle' | 'packing' | 'saving' | 'done'>('idle');
  if (!summary.data) return <LoadingState />;
  const chosen = summary.data[scope];

  async function start() {
    setStage('packing');
    try {
      if (!id) return;
      let link = await requestArchive(id, scope);
      while (link.status === 'building') {
        await new Promise((done) => setTimeout(done, 3000));
        if (!open.current) return;
        link = await requestArchive(id, scope);
      }
      if (link.status === 'failed') throw new Error('Packing the photos failed. Please try again.');
      if (!open.current) return;
      setStage('saving');
      if (Platform.OS === 'ios') {
        // Downloaded first, so the share sheet offers "Save to Files" for the ZIP itself.
        const dir = new Directory(Paths.cache, 'archives');
        dir.create({ intermediates: true, idempotent: true });
        const file = await File.downloadFileAsync(link.url, dir, { idempotent: true });
        await Share.share({ url: file.uri });
      } else {
        await Linking.openURL(link.url); // the browser saves it to Downloads
      }
      setStage('done');
    } catch (err) {
      setStage('idle');
      Alert.alert("Couldn't download", err instanceof Error ? err.message : 'Please try again.');
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <Text variant="eyebrow">Download</Text>
      <Text variant="h1">
        Every photo, <Text variant="h1" emphasis>full quality.</Text>
      </Text>
      <Text variant="caption" color="muted">
        Originals in a ZIP, in folders by who took them.
      </Text>

      <View style={styles.group}>
        {CHOICES.map((c, i) => {
          const selected = scope === c.value;
          return (
            <Pressable
              key={c.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              disabled={stage === 'packing' || stage === 'saving'}
              onPress={() => {
                setScope(c.value);
                setStage('idle');
              }}
              style={[styles.row, i > 0 && styles.divider]}>
              <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
              <Text variant="body" style={styles.flex}>
                {c.label}
              </Text>
              <Text variant="caption" color="muted" style={{ fontFamily: fonts.mono }}>
                {summary.data[c.value].count.toLocaleString('en-US')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {stage === 'done' ? (
        <View style={styles.done}>
          <View style={styles.doneIcon}>
            <Check size={18} color="#FFFFFF" />
          </View>
          <View style={styles.flex}>
            <Text variant="bodyStrong">Ready</Text>
            <Text variant="caption" color="muted">
              {chosen.count.toLocaleString('en-US')} originals · {size(chosen.bytes)}
            </Text>
          </View>
        </View>
      ) : stage === 'idle' ? (
        <Button
          label={chosen.count ? `Download ${chosen.count.toLocaleString('en-US')} · ${size(chosen.bytes)}` : 'No photos here yet'}
          leadingIcon={Download}
          fullWidth
          disabled={chosen.count === 0}
          onPress={start}
        />
      ) : (
        <View style={styles.packing}>
          <ActivityIndicator color={colors.primary} />
          <Text variant="caption" color="muted">
            {stage === 'packing'
              ? 'Packing originals… Big albums take a few minutes. You can close this and come back; it keeps going.'
              : 'Downloading the ZIP…'}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { padding: screenPadding, paddingTop: space['3xl'], gap: space.md + 2 },
  flex: { flex: 1, gap: 1 },
  group: { borderRadius: radius.lg + 2, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: 14 },
  divider: { borderTopWidth: 0.5, borderTopColor: colors.line },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  packing: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  done: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: 14, borderRadius: radius.lg, backgroundColor: colors.sage },
  doneIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
}));

/** Drawn in the open event's theme. */
export default function DownloadScreen() {
  return (
    <ThemeProvider theme={useCurrentEventTheme()}>
      <DownloadAll />
    </ThemeProvider>
  );
}
