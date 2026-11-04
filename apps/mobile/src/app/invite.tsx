import { RefreshCw, Share2 } from 'lucide-react-native';
import { Alert, ScrollView, Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button, LoadingState, Text } from '@/components/ui';
import { radius, screenPadding, space } from '@/constants/theme';
import { makeStyles, ThemeProvider, useCurrentEventTheme, useTheme } from '@/theme';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { useRotateCode } from '@/services/api/hooks';
import { formatCode, joinLink } from '@/utils/format';

/** One link + one QR per event. Anyone in the event can share it; only the host can reset it. */
function Invite() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { id, event, isHost } = useCurrentEvent();
  const rotate = useRotateCode(id ?? '');
  if (!event) return <LoadingState />;

  const link = joinLink(event.joinCode);

  function share() {
    if (!event) return;
    void Share.share({
      message: `Join "${event.name}" on eventShare and add your photos.\n\nCode: ${formatCode(event.joinCode)}\n${link}`,
    });
  }

  function confirmReset() {
    Alert.alert(
      'Reset invite link?',
      'The old link, QR and code stop working. People already in the event stay in.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => rotate.mutate() },
      ],
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <Text variant="eyebrow">Invite</Text>
      <Text variant="h1">
        Bring your <Text variant="h1" emphasis>people.</Text>
      </Text>
      <Text color="muted">Guests scan this, or open the link, and join {event.name}.</Text>

      <View style={styles.card}>
        <Text variant="h3" align="center">
          {event.name}
        </Text>
        <View style={styles.qr}>
          <QRCode value={link} size={196} color={colors.ink} backgroundColor={colors.surface} />
        </View>
        <Text style={styles.code} accessibilityLabel={`Code ${event.joinCode.split('').join(' ')}`}>
          {formatCode(event.joinCode)}
        </Text>
        <Text variant="caption" color="subtle" align="center">
          Or enter this code in eventShare → Join an event
        </Text>
      </View>

      <Button label="Share invite" leadingIcon={Share2} fullWidth onPress={share} />
      {isHost && (
        <Button label="Reset link and code" leadingIcon={RefreshCw} variant="ghost" fullWidth loading={rotate.isPending} onPress={confirmReset} />
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors, fonts }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { padding: screenPadding, paddingTop: space['3xl'], gap: space.md },
  card: {
    alignItems: 'center',
    gap: space.md,
    padding: space.xl,
    marginVertical: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  qr: { padding: space.sm },
  code: { fontFamily: fonts.mono, fontSize: 26, letterSpacing: 3, color: colors.ink },
}));

/** Drawn in the open event's theme. */
export default function InviteScreen() {
  return (
    <ThemeProvider theme={useCurrentEventTheme()}>
      <Invite />
    </ThemeProvider>
  );
}
