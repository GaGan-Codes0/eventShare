import { File } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { Printer, RefreshCw, Share2 } from 'lucide-react-native';
import { useRef, useState, type ComponentRef } from 'react';
import { Alert, ScrollView, Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';

import { toast } from '@/components/toast';
import { Button, LoadingState, Text } from '@/components/ui';
import { radius, screenPadding, space } from '@/constants/theme';
import { EventBadge } from '@/features/events/event-card';
import { longDate } from '@/features/events/identity';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { useRotateCode } from '@/services/api/hooks';
import { makeStyles, ThemeProvider, useCurrentEventTheme, useTheme } from '@/theme';
import { formatCode, joinLink } from '@/utils/format';

/**
 * One link + one QR per event, on a table card in the event's theme. Anyone in the event can
 * share it; only the host can reset it.
 */
function Invite() {
  const { colors, fonts } = useTheme();
  const styles = useStyles();
  const { id, event, isHost } = useCurrentEvent();
  const rotate = useRotateCode(id ?? '');
  const card = useRef<ComponentRef<typeof View>>(null);
  const [printing, setPrinting] = useState(false);
  if (!event) return <LoadingState />;

  const link = joinLink(event.joinCode);

  function share() {
    if (!event) return;
    void Share.share({
      message: `Join "${event.name}" on eventShare and add your photos.\n\nCode: ${formatCode(event.joinCode)}\n${link}`,
    });
  }

  /** The card as a sharp image in Photos, ready to print for the tables. */
  async function saveCard() {
    setPrinting(true);
    try {
      const perm = await requestPermissionsAsync(true);
      if (!perm.granted) throw new Error('Allow eventShare to add photos in Settings.');
      const uri = await captureRef(card, { format: 'png', width: 1500, result: 'tmpfile' });
      await Asset.create(uri);
      new File(uri).delete();
      toast('Table card saved to your Photos');
    } catch (err) {
      Alert.alert("Couldn't save the card", err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setPrinting(false);
    }
  }

  function confirmReset() {
    Alert.alert('Reset invite link?', 'The old link, QR and code stop working. People already in the event stay in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => rotate.mutate(undefined, { onSuccess: () => toast('New code. The old one stops working') }) },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <Text variant="eyebrow">Invite guests</Text>
      <Text variant="h1">
        Scan, and <Text variant="h1" emphasis>you’re in.</Text>
      </Text>

      <View ref={card} collapsable={false} style={styles.card}>
        <EventBadge event={event} size={46} />
        <Text variant="eyebrow" style={{ color: colors.primaryText }}>
          Share your photos with us
        </Text>
        <Text variant="h1" align="center">
          {event.name}
        </Text>
        {event.startsAt && (
          <Text variant="caption" color="muted">
            {longDate(event.startsAt)}
          </Text>
        )}
        <View style={styles.qr}>
          <QRCode value={link} size={132} color="#000000" backgroundColor="#FFFFFF" />
        </View>
        <Text style={[styles.code, { fontFamily: fonts.mono }]} accessibilityLabel={`Code ${event.joinCode.split('').join(' ')}`}>
          {formatCode(event.joinCode)}
        </Text>
        <Text variant="caption" color="muted">
          Open eventShare › Join an event
        </Text>
      </View>

      <Button label="Download table card" leadingIcon={Printer} fullWidth loading={printing} onPress={saveCard} />
      <Button label="Share invite link" leadingIcon={Share2} variant="secondary" fullWidth onPress={share} />
      {isHost && (
        <Button label="Reset link and code" leadingIcon={RefreshCw} variant="ghost" fullWidth loading={rotate.isPending} onPress={confirmReset} />
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { padding: screenPadding, paddingTop: space['3xl'], gap: space.md + 2 },
  card: {
    alignSelf: 'center',
    width: 260,
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.xl,
    paddingHorizontal: 18,
    paddingBottom: 18,
    marginVertical: space.sm,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
  },
  qr: { marginTop: space.xs, padding: space.xs, borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  code: { fontSize: 22, lineHeight: 28, letterSpacing: 2.6, color: colors.ink },
}));

/** Drawn in the open event's theme. */
export default function InviteScreen() {
  return (
    <ThemeProvider theme={useCurrentEventTheme()}>
      <Invite />
    </ThemeProvider>
  );
}
