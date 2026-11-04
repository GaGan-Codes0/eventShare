import { PASSWORD_MIN_LENGTH, type AuthSession } from '@eventshare/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowRight, Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text, TextField, Wordmark } from '@/components/ui';
import { screenPadding, space } from '@/constants/theme';
import { api } from '@/services/api/client';
import { setSession } from '@/services/api/session';
import { setCurrentEvent } from '@/store/current-event';
import { useTheme } from '@/theme';

type Mode = 'login' | 'signup';

/** Log in, or create an account with name + email + password. */
export default function SignIn() {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === 'signup';
  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const passwordOk = isSignup ? password.length >= PASSWORD_MIN_LENGTH : password.length > 0;
  const canSubmit = emailOk && passwordOk && (!isSignup || name.trim().length > 0);

  function switchMode() {
    setError(null);
    setMode(isSignup ? 'login' : 'signup');
  }

  async function submit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const session = await api<AuthSession>(isSignup ? '/auth/signup' : '/auth/login', {
        body: isSignup ? { name: name.trim(), email: email.trim(), password } : { email: email.trim(), password },
      });
      qc.clear();
      setCurrentEvent(null);
      await setSession(session);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Wordmark />
          <View style={styles.hero}>
            <Text variant="eyebrow">{isSignup ? 'Create your account' : 'Welcome back'}</Text>
            {isSignup ? (
              <Text variant="h1">
                Join the <Text variant="h1" emphasis>roll.</Text>
              </Text>
            ) : (
              <Text variant="h1">
                Every photo, <Text variant="h1" emphasis>everyone’s.</Text>
              </Text>
            )}
            {isSignup && <Text color="muted">Your name appears on the photos you share with an event.</Text>}
          </View>

          {isSignup && (
            <TextField
              label="Your name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Riya Sharma"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
            />
          )}
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType={isSignup ? 'username' : 'emailAddress'}
            autoCorrect={false}
          />
          <View>
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              textContentType={isSignup ? 'newPassword' : 'password'}
              returnKeyType="go"
              onSubmitEditing={submit}
              hint={isSignup ? `At least ${PASSWORD_MIN_LENGTH} characters` : undefined}
              error={error}
              style={styles.passwordInput}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              hitSlop={8}
              onPress={() => setShowPassword((v) => !v)}
              style={styles.eye}>
              {showPassword ? <EyeOff size={20} color={colors.muted} /> : <Eye size={20} color={colors.muted} />}
            </Pressable>
          </View>

          <Button
            label={isSignup ? 'Create account' : 'Log in'}
            trailingIcon={ArrowRight}
            fullWidth
            loading={busy}
            disabled={!canSubmit}
            onPress={submit}
          />
          <Button
            label={isSignup ? 'Already have an account? Log in' : 'New here? Create an account'}
            variant="ghost"
            disabled={busy}
            onPress={switchMode}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  body: { paddingHorizontal: screenPadding, paddingTop: space.xl, paddingBottom: space['3xl'], gap: space.lg },
  hero: { gap: space.md, marginTop: space['2xl'], marginBottom: space.sm },
  passwordInput: { paddingRight: 48 },
  // Centred in the input box, below the field's label.
  eye: { position: 'absolute', right: space.md, top: 54 },
});
