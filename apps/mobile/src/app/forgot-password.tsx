import { forgotPasswordSchema, PASSWORD_MIN_LENGTH, RESET_CODE_LENGTH, resetPasswordSchema, type AuthSession } from '@eventshare/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toast } from '@/components/toast';
import { Button, Text, TextField } from '@/components/ui';
import { screenPadding, space } from '@/constants/theme';
import { api } from '@/services/api/client';
import { setSession } from '@/services/api/session';
import { setCurrentEvent } from '@/store/current-event';
import { makeStyles, useTheme } from '@/theme';
import { clock } from '@/utils/format';

/** How long before another code can be asked for (the server sends at most one a minute). */
const RESEND_SECONDS = 60;

/**
 * Forgot password: email a 6-digit code, then the code and a new password. Setting it signs you in
 * here and signs out every other phone. The first step answers the same way for any email, so it
 * never tells who has an account.
 */
export default function ForgotPassword() {
  const { colors } = useTheme();
  const styles = useStyles();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ email?: string }>();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  /** Taken the moment a request starts, before the screen redraws: a second quick tap does nothing. */
  const inFlight = useRef(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function run(work: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function sendCode() {
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) return setError('Enter a valid email');
    void run(async () => {
      await api('/auth/password/forgot', { body: parsed.data });
      setEmail(parsed.data.email);
      setCode('');
      setStep('code');
      setResendIn(RESEND_SECONDS);
    });
  }

  function setNewPassword() {
    const parsed = resetPasswordSchema.safeParse({ email, code, password });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the code and the new password');
    void run(async () => {
      const session = await api<AuthSession>('/auth/password/reset', { body: parsed.data });
      qc.clear();
      setCurrentEvent(null);
      await setSession(session);
      router.replace('/');
      toast('Password changed. You’re signed in');
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAwareScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" bottomOffset={24}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
        <View style={styles.heading}>
          <Text variant="eyebrow">Forgot password</Text>
          <Text variant="h1">
            Set a new <Text variant="h1" emphasis>password.</Text>
          </Text>
          <Text color="muted">
            {step === 'email'
              ? `We’ll email you a ${RESET_CODE_LENGTH}-digit code.`
              : `If ${email} has a Klickers password, a ${RESET_CODE_LENGTH}-digit code is on its way. It works for 15 minutes.`}
          </Text>
        </View>

        {step === 'email' ? (
          <>
            <TextField
              testID="forgot-email"
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={sendCode}
              error={error}
            />
            <Button label="Send code" fullWidth loading={busy} disabled={!email.trim()} onPress={sendCode} />
          </>
        ) : (
          <>
            <TextField
              testID="forgot-code"
              label="Code from the email"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, RESET_CODE_LENGTH))}
              placeholder="123456"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={RESET_CODE_LENGTH}
            />
            <TextField
              testID="forgot-new-password"
              label="New password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={setNewPassword}
              hint={`At least ${PASSWORD_MIN_LENGTH} characters. Signs you out on your other phones.`}
              error={error}
            />
            <Button
              label="Set new password"
              fullWidth
              loading={busy}
              disabled={code.length !== RESET_CODE_LENGTH || password.length < PASSWORD_MIN_LENGTH}
              onPress={setNewPassword}
            />
            <Button
              label={resendIn > 0 ? `Send a new code in ${clock(resendIn * 1000)}` : 'Send a new code'}
              variant="ghost"
              fullWidth
              disabled={busy || resendIn > 0}
              onPress={sendCode}
            />
            <Button
              label="Use a different email"
              variant="ghost"
              fullWidth
              disabled={busy}
              onPress={() => {
                setError(null);
                setStep('email');
              }}
            />
          </>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.paper },
  body: { paddingHorizontal: screenPadding, paddingBottom: space['3xl'], gap: space.lg },
  back: { width: 40, height: 40, justifyContent: 'center', marginTop: space.sm },
  heading: { gap: space.sm, marginBottom: space.sm },
}));
