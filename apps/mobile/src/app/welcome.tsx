import { router } from 'expo-router';
import { Plus, ScanLine } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text, Wordmark } from '@/components/ui';
import { colors, radius, screenPadding, space } from '@/constants/theme';

/** First run: you're not in any event yet. */
export default function Welcome() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Wordmark />
        <View style={styles.card}>
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
        <View style={styles.actions}>
          <Button label="Join an event" leadingIcon={ScanLine} fullWidth onPress={() => router.push('/join')} />
          <Button label="Create an event" leadingIcon={Plus} variant="secondary" fullWidth onPress={() => router.push('/create-event')} />
          <Text variant="caption" color="subtle" align="center">
            Got a code or a QR from your host? Join with it.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: screenPadding, paddingTop: space.xl, gap: space['2xl'] },
  card: {
    flex: 1,
    maxHeight: 420,
    justifyContent: 'flex-end',
    gap: space.md,
    padding: space['2xl'],
    borderRadius: radius.xl,
    backgroundColor: colors.viewfinder,
  },
  actions: { gap: space.md, marginTop: 'auto', marginBottom: space.lg },
});
