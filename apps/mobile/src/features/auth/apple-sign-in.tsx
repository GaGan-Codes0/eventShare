import type { AuthSession } from '@eventshare/shared';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { api } from '@/services/api/client';

/** True on iPhones that can show the Apple button (iOS 13+). Never on Android. */
export function useAppleSignInAvailable() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, []);
  return available;
}

/**
 * Asks Apple to sign the person in, then trades Apple's token for our own session. A random
 * nonce goes to Apple hashed and to our server as is, so the server knows the token was made for
 * this sign-in. Returns null if the person closed Apple's sheet.
 */
export async function signInWithApple(): Promise<AuthSession | null> {
  const nonce = Crypto.randomUUID() + Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashed,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw new Error('Apple sign-in failed. Please try again.');
  }
  if (!credential.identityToken) throw new Error('Apple sign-in failed. Please try again.');
  // Apple shares the name only the first time; later sign-ins keep the name we already have.
  const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ') || undefined;
  return api<AuthSession>('/auth/apple', { body: { identityToken: credential.identityToken, nonce, name } });
}

/** Apple's own button, as its guidelines require: black, full width, the same height as our buttons. */
export function AppleSignInButton({ onPress, signup }: { onPress: () => void; signup: boolean }) {
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={signup ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={14}
      style={styles.button}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({ button: { width: '100%', height: 48 } });
