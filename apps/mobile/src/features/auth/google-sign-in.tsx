import type { AuthSession } from '@eventshare/shared';
import { GoogleSignin, isCancelledResponse, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { api } from '@/services/api/client';
import { defaultTheme } from '@/theme';

/**
 * Our OAuth client IDs, from the Klickers project in Google Cloud (Google Auth Platform → Clients). Not secret.
 * The web client is the one the server checks tokens against; iOS also needs its own client (its reversed ID
 * is the URL scheme in app.json). Android finds its client by the app's package name and signing certificate.
 */
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '1013281717078-etedjrqklfid6tv9qdt83md34gqu3a45.apps.googleusercontent.com';
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '1013281717078-4vo32npedk2cd9nuovbqj49nrevli021.apps.googleusercontent.com';

/** Whether this build has Google sign-in set up; the button is hidden until it does. */
export const googleSignInAvailable = !!WEB_CLIENT_ID;

let configured = false;
function configure() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, ...(IOS_CLIENT_ID ? { iosClientId: IOS_CLIENT_ID } : {}) });
  configured = true;
}

/** Opens Google's account picker, then trades Google's ID token for our own session. Null if the person closed it. */
export async function signInWithGoogle(): Promise<AuthSession | null> {
  configure();
  let idToken: string | null;
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) return null;
    idToken = response.data.idToken;
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return null;
    if (isErrorWithCode(e) && e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Google sign-in needs Google Play services on this phone.');
    }
    throw new Error('Google sign-in failed. Please try again.');
  }
  if (!idToken) throw new Error('Google sign-in failed. Please try again.');
  // Our session is what keeps the person signed in; Google's is only needed for this one sign-in.
  void GoogleSignin.signOut().catch(() => undefined);
  return api<AuthSession>('/auth/google', { body: { idToken } });
}

/** Google's standard light button (its branding rules): white, grey outline, the four-colour G. */
export function GoogleSignInButton({ onPress, signup, disabled }: { onPress: () => void; signup: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={signup ? 'Sign up with Google' : 'Sign in with Google'}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Svg width={18} height={18} viewBox="0 0 48 48">
        <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </Svg>
      <Text style={styles.label}>{signup ? 'Sign up with Google' : 'Sign in with Google'}</Text>
    </Pressable>
  );
}

const { fonts } = defaultTheme;

// Google's button colours are fixed by its branding rules, so they don't follow the event theme.
const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#747775',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  pressed: { backgroundColor: '#F2F2F2' },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: '#1F1F1F' },
});
