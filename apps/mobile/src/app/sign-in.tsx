import { PASSWORD_MIN_LENGTH, type AuthSession } from '@eventshare/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowRight, Camera, Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text, TextField, Wordmark } from '@/components/ui';
import { screenPadding, space } from '@/constants/theme';
import { api } from '@/services/api/client';
import { setSession } from '@/services/api/session';
import { setCurrentEvent } from '@/store/current-event';
import { defaultTheme, useTheme } from '@/theme';

type Mode = 'login' | 'signup';

/**
 * The prototype's welcome: three tilted prints of its own scenes (string lights, marigold
 * garlands, petals), drawn at the prototype's sizes on its 360-wide phone and centred here.
 */
const WELCOME = [
  require('../../assets/images/welcome/welcome-1.jpg'),
  require('../../assets/images/welcome/welcome-2.jpg'),
  require('../../assets/images/welcome/welcome-3.jpg'),
];

function Collage() {
  return (
    <View style={styles.collage} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.stage}>
        <View style={[styles.print, styles.printLeft]}>
          <Image source={WELCOME[0]} style={styles.printImage} contentFit="cover" />
        </View>
        <View style={[styles.print, styles.printRight]}>
          <Image source={WELCOME[1]} style={styles.printImage} contentFit="cover" />
        </View>
        <View style={[styles.print, styles.printFront]}>
          <Image source={WELCOME[2]} style={styles.printImage} contentFit="cover" />
          <View style={styles.shared}>
            <Text style={styles.sharedText} numberOfLines={1}>
              Shared by 38 guests
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/** The prototype's sign-in wordmark: a little tilted camera and "eventShare", a size up from the app bar's. */
function WelcomeMark() {
  return (
    <View style={styles.mark} accessibilityRole="header" accessibilityLabel="eventShare">
      <View style={styles.markSymbol}>
        <Camera size={15} color={INK} strokeWidth={1.75} />
      </View>
      <Text style={styles.markText}>eventShare</Text>
    </View>
  );
}

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
      {/* The field being typed in always scrolls above the keyboard, on iPhone and Android. */}
      <View style={styles.flex}>
        <KeyboardAwareScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          bottomOffset={24}
          showsVerticalScrollIndicator={false}>
          {!isSignup && <Collage />}
          {isSignup ? (
            <>
              <Wordmark />
              <View style={styles.hero}>
                <Text variant="eyebrow">Create your account</Text>
                <Text variant="h1">
                  Join the <Text variant="h1" emphasis>roll.</Text>
                </Text>
                <Text color="muted">Your name appears on the photos you share with an event.</Text>
              </View>
            </>
          ) : (
            // As in the prototype: wordmark, then the headline over two lines and the line under it.
            <View style={styles.welcome}>
              <WelcomeMark />
              <Text style={styles.headline}>
                {'Every photo,\n'}
                <Text style={styles.headlineItalic}>everyone’s.</Text>
              </Text>
              <Text style={styles.lede}>Join an event with its QR code or 6-digit code. Every guest’s shots land in one shared album.</Text>
            </View>
          )}

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
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaView>
  );
}

/** Sign-in is always in eventShare's own look. */
const { fonts } = defaultTheme;
/** The prototype's ink. */
const INK = '#273C32';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAF9F5' },
  flex: { flex: 1 },
  body: { paddingHorizontal: screenPadding, paddingTop: space.xl, paddingBottom: space['3xl'], gap: space.lg },
  hero: { gap: space.md, marginTop: space.lg, marginBottom: space.sm },
  // The prototype's collage: 312 tall, cards placed on a 360-wide phone (centred on wider ones).
  collage: { height: 312, marginHorizontal: -screenPadding, marginTop: -space.xl, alignItems: 'center' },
  stage: { width: 360, height: 312 },
  print: {
    position: 'absolute',
    width: 146,
    height: 183,
    borderRadius: 14,
    backgroundColor: '#E9EDDF',
    // A white print border outside the photo, and a soft drop shadow under it.
    boxShadow: '0px 18px 30px -16px rgba(28,36,32,0.5), 0px 0px 0px 4px #FFFEFA',
  },
  printImage: { width: '100%', height: '100%', borderRadius: 14 },
  printLeft: { left: 26, top: 34, transform: [{ rotate: '-8deg' }] },
  printRight: { right: 26, top: 22, backgroundColor: '#F0EADD', transform: [{ rotate: '7deg' }] },
  printFront: {
    left: 104,
    top: 108,
    width: 152,
    height: 190,
    transform: [{ rotate: '-1.5deg' }],
    boxShadow: '0px 22px 34px -16px rgba(28,36,32,0.55), 0px 0px 0px 4px #FFFEFA',
  },
  shared: { position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.92)' },
  sharedText: { fontFamily: fonts.sansSemiBold, fontSize: 10, lineHeight: 14, color: INK },
  welcome: { gap: 12, paddingTop: 6, marginBottom: space.sm },
  mark: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  markSymbol: {
    width: 28,
    height: 25,
    borderWidth: 1.5,
    borderColor: INK,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-7deg' }],
  },
  markText: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 28, letterSpacing: -0.96, color: INK },
  headline: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 37, letterSpacing: -0.85, color: INK },
  headlineItalic: { fontFamily: fonts.serifItalic, fontSize: 34, lineHeight: 37, letterSpacing: -0.85, color: '#748063' },
  // The prototype's line is 312 wide (360 less its margins), so it breaks into the same three lines.
  lede: { fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 21, color: '#7E8378', maxWidth: 312 },
  passwordInput: { paddingRight: 48 },
  // Centred in the input box, below the field's label.
  eye: { position: 'absolute', right: space.md, top: 54 },
});
