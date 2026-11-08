import { router } from 'expo-router';
import { ArrowUpRight, ChevronRight, Hash, ScanLine, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';

const SAGE = '#CDD7AB';

/** The prototype's big dark card: an icon, a corner arrow, a serif title and a line under it. */
export function BigActionCard({
  icon: Icon,
  title,
  caption,
  onPress,
  minHeight = 208,
}: {
  icon: LucideIcon;
  title: string;
  caption: string;
  onPress: () => void;
  minHeight?: number;
}) {
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.big, { minHeight }, pressed && { transform: [{ scale: 0.99 }] }]}>
      <View style={styles.bigIcon}>
        <Icon size={26} color={SAGE} />
      </View>
      <View style={styles.bigArrow}>
        <ArrowUpRight size={20} color={SAGE} />
      </View>
      <View style={styles.gap4}>
        <Text style={styles.bigTitle}>{title}</Text>
        <Text variant="caption" style={styles.bigCaption}>
          {caption}
        </Text>
      </View>
    </Pressable>
  );
}

/** Join an event: scan the host's QR, or type the 6-digit code. */
export function JoinCards() {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <>
      <BigActionCard icon={ScanLine} title="Scan the QR code" caption="On your table card, invite or the venue screen" onPress={() => router.push('/join-scan')} />
      <Pressable accessibilityRole="button" onPress={() => router.push('/join-code')} style={({ pressed }) => [styles.code, pressed && { backgroundColor: colors.field }]}>
        <View style={styles.codeIcon}>
          <Hash size={21} color={colors.ink} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong" style={styles.codeTitle}>
            Enter event code
          </Text>
          <Text variant="caption" color="muted">
            6 digits from your host
          </Text>
        </View>
        <ChevronRight size={18} color={colors.ink} />
      </Pressable>
    </>
  );
}

const useStyles = makeStyles(({ colors, fonts }) => ({
  flex: { flex: 1, gap: 2 },
  gap4: { gap: space.xs },
  big: { borderRadius: 22, backgroundColor: '#304538', padding: space.xl, justifyContent: 'space-between' },
  bigIcon: { width: 54, height: 54, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(205,215,171,0.35)', alignItems: 'center', justifyContent: 'center' },
  bigArrow: { position: 'absolute', top: space.xl, right: space.xl },
  bigTitle: { fontFamily: fonts.serif, fontSize: 27, lineHeight: 31, letterSpacing: -0.5, color: '#F4F2DF' },
  bigCaption: { color: 'rgba(244,242,223,0.78)' },
  code: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  codeIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.warm, alignItems: 'center', justifyContent: 'center' },
  codeTitle: { fontSize: 16, lineHeight: 21 },
}));
