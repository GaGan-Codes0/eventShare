import { JOIN_CODE_LENGTH } from '@eventshare/shared';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ChevronLeft, Delete } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { FocusStatusBar } from '@/components/focus-status-bar';
import { radius, screenPadding, space } from '@/constants/theme';
import { useJoinPreview } from '@/services/api/hooks';
import { makeStyles, useTheme } from '@/theme';
import { formatCode } from '@/utils/format';

/** The prototype's number pad: 1–9, then 0 and delete. The phone's keyboard never opens here. */
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'] as const;

/** Type the 6-digit code from the invite or table card; the event opens as soon as it's found. */
export default function JoinCode() {
  const { colors, fonts } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const complete = code.length === JOIN_CODE_LENGTH;
  const preview = useJoinPreview(complete ? code : null);

  useEffect(() => {
    if (preview.isSuccess && complete) router.replace({ pathname: '/join-preview', params: { code } });
  }, [preview.isSuccess, complete, code]);

  function press(key: (typeof KEYS)[number]) {
    if (!key) return;
    void Haptics.selectionAsync();
    setCode((c) => (key === 'back' ? c.slice(0, -1) : c.length < JOIN_CODE_LENGTH ? c + key : c));
  }

  const error = preview.isError && complete ? `No event uses ${formatCode(code)}. Check the code with your host.` : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + space.md }]}>
      <FocusStatusBar style="dark" />
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
      </View>
      <View style={styles.heading}>
        <Text variant="eyebrow">Join an event</Text>
        <Text variant="h1">
          Enter your <Text variant="h1" emphasis>event code.</Text>
        </Text>
        <Text variant="caption" color="muted">
          The 6-digit number on your invite or table card.
        </Text>
      </View>

      <View accessible accessibilityLabel={`Event code, ${code.length} of ${JOIN_CODE_LENGTH} digits entered`} style={styles.boxes}>
        {Array.from({ length: JOIN_CODE_LENGTH }, (_, i) => (
          <View
            key={i}
            style={[
              styles.box,
              i === JOIN_CODE_LENGTH / 2 && styles.gapBefore,
              { borderColor: error ? colors.danger : i === code.length && !complete ? colors.ink : colors.lineStrong },
            ]}>
            <Text style={[styles.char, { fontFamily: fonts.mono }]}>{code[i] ?? ''}</Text>
          </View>
        ))}
      </View>

      <View style={styles.message}>
        {preview.isFetching ? (
          <View style={styles.row}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text variant="label" style={{ color: colors.primaryText }}>
              Finding your event…
            </Text>
          </View>
        ) : error ? (
          <Text variant="label" color="danger" align="center">
            {error}
          </Text>
        ) : null}
      </View>

      <View style={styles.pad}>
        {KEYS.map((key, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={key === 'back' ? 'Delete' : key}
            disabled={!key}
            onPress={() => press(key)}
            style={({ pressed }) => [styles.key, key === 'back' && styles.keyBack, !key && styles.keyEmpty, pressed && { opacity: 0.6 }]}>
            {key === 'back' ? <Delete size={22} color={colors.ink} /> : <Text style={styles.keyText}>{key}</Text>}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, fonts }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  top: { height: 54, paddingHorizontal: space.sm, flexDirection: 'row', alignItems: 'center' },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  heading: { paddingHorizontal: screenPadding + 4, paddingTop: space.xs, gap: 6 },
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 26, paddingBottom: space.md },
  box: { width: 44, height: 56, borderRadius: radius.md, borderWidth: 1.5, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  gapBefore: { marginLeft: space.md },
  char: { fontSize: 24, color: colors.ink },
  message: { minHeight: 40, paddingHorizontal: screenPadding + 4, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // Sits at the bottom, where a keyboard would be.
  pad: { marginTop: 'auto', flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: screenPadding - 4, gap: space.sm },
  key: { width: '31.6%', height: 54, borderRadius: radius.md, backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center' },
  keyBack: { backgroundColor: 'transparent' },
  keyEmpty: { backgroundColor: 'transparent' },
  keyText: { fontFamily: fonts.sans, fontSize: 22, lineHeight: 28, color: colors.ink },
}));
