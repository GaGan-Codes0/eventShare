import { JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH } from '@eventshare/shared';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { FocusStatusBar } from '@/components/focus-status-bar';
import { radius, screenPadding, space } from '@/constants/theme';
import { useJoinPreview } from '@/services/api/hooks';
import { makeStyles, useTheme } from '@/theme';

const ALLOWED = new Set(JOIN_CODE_ALPHABET);

/** Type the 8-character code from the invite or table card; the event opens as soon as it's found. */
export default function JoinCode() {
  const { colors, fonts } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [code, setCode] = useState('');
  const complete = code.length === JOIN_CODE_LENGTH;
  const preview = useJoinPreview(complete ? code : null);

  useEffect(() => {
    if (preview.isSuccess && complete) router.replace({ pathname: '/join-preview', params: { code } });
  }, [preview.isSuccess, complete, code]);

  function type(text: string) {
    // Only letters and digits a code can contain; case and dashes don't matter.
    const clean = [...text.toUpperCase().replace(/[\s-]/g, '')].filter((c) => ALLOWED.has(c)).join('');
    setCode(clean.slice(0, JOIN_CODE_LENGTH));
  }

  const error = preview.isError ? `No event uses ${code.slice(0, 4)}-${code.slice(4)}. Check the code with your host.` : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
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
          The 8 characters on your invite or table card.
        </Text>
      </View>

      <Pressable accessibilityLabel={`Event code, ${code.length} of ${JOIN_CODE_LENGTH} entered`} onPress={() => input.current?.focus()} style={styles.boxes}>
        {Array.from({ length: JOIN_CODE_LENGTH }, (_, i) => (
          <View
            key={i}
            style={[
              styles.box,
              i === 4 && styles.gapBefore,
              { borderColor: error ? colors.danger : i === code.length && !complete ? colors.primary : colors.lineStrong },
            ]}>
            <Text style={[styles.char, { fontFamily: fonts.mono }]}>{code[i] ?? ''}</Text>
          </View>
        ))}
      </Pressable>
      <TextInput
        ref={input}
        value={code}
        onChangeText={type}
        autoFocus
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={JOIN_CODE_LENGTH + 1}
        style={styles.hidden}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />

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
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  top: { height: 54, paddingHorizontal: space.sm, flexDirection: 'row', alignItems: 'center' },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  heading: { paddingHorizontal: screenPadding + 4, paddingTop: space.xs, gap: 6 },
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingTop: 26, paddingBottom: space.md },
  box: { width: 36, height: 52, borderRadius: radius.md, borderWidth: 1.5, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  gapBefore: { marginLeft: space.sm },
  char: { fontSize: 22, color: colors.ink },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  message: { minHeight: 40, paddingHorizontal: screenPadding + 4, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
}));
