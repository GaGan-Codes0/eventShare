// Clerk sign-in screen (email + password, email codes, Google), switched off for now.
// To bring it back: uncomment, move it to src/app/sign-in.tsx, and restore ClerkProvider in
// src/app/_layout.tsx and the Clerk lines in services/api/session.ts.
//
// import { useSignIn, useSignUp, useSSO } from '@clerk/expo';
// import * as AuthSession from 'expo-auth-session';
// import { router } from 'expo-router';
// import * as WebBrowser from 'expo-web-browser';
// import { ArrowLeft, ArrowRight, Mail } from 'lucide-react-native';
// import { useState, type ReactNode } from 'react';
// import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
//
// import { Button, Text, TextField, Wordmark } from '@/components/ui';
// import { colors, fonts, screenPadding, space } from '@/constants/theme';
//
// // Closes the Google sign-in browser tab once it redirects back to the app.
// WebBrowser.maybeCompleteAuthSession();
//
// /**
//  * signIn / signUp: the two forms. code: a 6-digit email code, sent to confirm a new account
//  * (`signUp`), to trust a new device (`device`), or to reset a password (`reset`).
//  * newPassword: the last step of a reset.
//  */
// type Step = 'signIn' | 'signUp' | 'code' | 'newPassword';
// type CodePurpose = 'signUp' | 'device' | 'reset';
//
// /** Clerk API errors carry the useful code/message on their first entry. */
// function describe(error: unknown) {
//   const e = error as { code?: string; message?: string; errors?: { code: string; message: string; longMessage?: string }[] };
//   const first = e.errors?.[0];
//   return { code: first?.code ?? e.code ?? '', message: first?.longMessage ?? first?.message ?? e.message ?? 'Something went wrong' };
// }
//
// /** Throws Clerk's `{ error }` results so every step can share one error path. */
// function ok(result: { error: unknown }) {
//   if (result.error) throw result.error;
// }
//
// export default function SignIn() {
//   const { signIn } = useSignIn();
//   const { signUp } = useSignUp();
//   const { startSSOFlow } = useSSO();
//   const [step, setStep] = useState<Step>('signIn');
//   const [purpose, setPurpose] = useState<CodePurpose>('signUp');
//   const [name, setName] = useState('');
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [code, setCode] = useState('');
//   const [error, setError] = useState<string | null>(null);
//   const [busy, setBusy] = useState(false);
//
//   const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
//
//   function go(next: Step) {
//     setError(null);
//     setCode('');
//     setStep(next);
//   }
//
//   async function run(task: () => Promise<void>) {
//     setBusy(true);
//     setError(null);
//     try {
//       await task();
//     } catch (err) {
//       setError(describe(err).message);
//     } finally {
//       setBusy(false);
//     }
//   }
//
//   async function askForCode(next: CodePurpose, send: () => Promise<{ error: unknown }>) {
//     ok(await send());
//     setPurpose(next);
//     go('code');
//   }
//
//   /** Signed in: make the session active and let the gate route to events. */
//   async function finish(resource: { finalize: () => Promise<{ error: unknown }> }) {
//     ok(await resource.finalize());
//     router.replace('/');
//   }
//
//   const submitSignIn = () =>
//     run(async () => {
//       const res = await signIn.password({ emailAddress: email.trim(), password });
//       if (res.error) {
//         if (describe(res.error).code === 'form_identifier_not_found') {
//           setStep('signUp');
//           throw new Error('No account with that email yet. Create one below.');
//         }
//         throw res.error;
//       }
//       if (signIn.status === 'complete') return finish(signIn);
//       // New device (or 2-step verification on): confirm with a code sent to your email.
//       if (signIn.status === 'needs_client_trust' || signIn.status === 'needs_second_factor') {
//         return askForCode('device', () => signIn.mfa.sendEmailCode());
//       }
//       throw new Error('This account needs a sign-in step eventShare doesn’t support yet.');
//     });
//
//   const submitSignUp = () =>
//     run(async () => {
//       const [firstName, ...rest] = name.trim().split(/\s+/);
//       ok(await signUp.password({ emailAddress: email.trim(), password, firstName, lastName: rest.join(' ') || undefined }));
//       await askForCode('signUp', () => signUp.verifications.sendEmailCode());
//     });
//
//   const forgotPassword = () =>
//     run(async () => {
//       ok(await signIn.create({ identifier: email.trim() }));
//       await askForCode('reset', () => signIn.resetPasswordEmailCode.sendCode());
//     });
//
//   const submitCode = () =>
//     run(async () => {
//       const entered = { code: code.trim() };
//       if (purpose === 'signUp') {
//         ok(await signUp.verifications.verifyEmailCode(entered));
//         if (signUp.status !== 'complete') {
//           throw new Error(`Clerk still needs: ${signUp.missingFields.join(', ')}. Check the sign-up settings in Clerk.`);
//         }
//         return finish(signUp);
//       }
//       if (purpose === 'device') {
//         ok(await signIn.mfa.verifyEmailCode(entered));
//         return finish(signIn);
//       }
//       ok(await signIn.resetPasswordEmailCode.verifyCode(entered));
//       setPassword('');
//       go('newPassword');
//     });
//
//   const submitNewPassword = () =>
//     run(async () => {
//       ok(await signIn.resetPasswordEmailCode.submitPassword({ password }));
//       return finish(signIn);
//     });
//
//   const withGoogle = () =>
//     run(async () => {
//       const { createdSessionId, setActive } = await startSSOFlow({
//         strategy: 'oauth_google',
//         redirectUrl: AuthSession.makeRedirectUri(),
//       });
//       if (!createdSessionId || !setActive) return; // Cancelled, or Clerk needs more details.
//       await setActive({ session: createdSessionId });
//       router.replace('/');
//     });
//
//   const emailField = (
//     <TextField
//       label="Email"
//       value={email}
//       onChangeText={setEmail}
//       placeholder="you@example.com"
//       keyboardType="email-address"
//       autoCapitalize="none"
//       autoComplete="email"
//       textContentType={step === 'signUp' ? 'username' : 'emailAddress'}
//       autoCorrect={false}
//     />
//   );
//
//   return (
//     <SafeAreaView style={styles.safe}>
//       <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
//         <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
//           <Wordmark />
//
//           {step === 'signIn' && (
//             <>
//               <Hero eyebrow="Welcome back" title="Every photo," emphasis="everyone’s." />
//               {emailField}
//               <TextField
//                 label="Password"
//                 value={password}
//                 onChangeText={setPassword}
//                 secureTextEntry
//                 autoComplete="current-password"
//                 textContentType="password"
//                 returnKeyType="go"
//                 onSubmitEditing={() => emailOk && password && void submitSignIn()}
//                 error={error}
//               />
//               <Button
//                 label="Sign in"
//                 trailingIcon={ArrowRight}
//                 fullWidth
//                 loading={busy}
//                 disabled={!emailOk || !password}
//                 onPress={submitSignIn}
//               />
//               <Button label="Forgot password?" variant="ghost" disabled={!emailOk || busy} onPress={forgotPassword} />
//               <Divider />
//               <Button label="Continue with Google" variant="secondary" fullWidth disabled={busy} onPress={withGoogle} />
//               <Button label="New here? Create an account" variant="ghost" onPress={() => go('signUp')} />
//             </>
//           )}
//
//           {step === 'signUp' && (
//             <>
//               <Hero
//                 eyebrow="Create your account"
//                 title="Join the"
//                 emphasis="roll."
//                 body="Your name appears on the photos you share with an event."
//               />
//               <TextField
//                 label="Your name"
//                 value={name}
//                 onChangeText={setName}
//                 placeholder="e.g. Riya Sharma"
//                 autoCapitalize="words"
//                 autoComplete="name"
//                 textContentType="name"
//               />
//               {emailField}
//               <TextField
//                 label="Password"
//                 value={password}
//                 onChangeText={setPassword}
//                 secureTextEntry
//                 autoComplete="new-password"
//                 textContentType="newPassword"
//                 returnKeyType="go"
//                 onSubmitEditing={() => name.trim() && emailOk && password && void submitSignUp()}
//                 error={error}
//               />
//               <Button
//                 label="Create account"
//                 trailingIcon={ArrowRight}
//                 fullWidth
//                 loading={busy}
//                 disabled={!name.trim() || !emailOk || !password}
//                 onPress={submitSignUp}
//               />
//               <Button label="Already have an account? Sign in" variant="ghost" onPress={() => go('signIn')} />
//             </>
//           )}
//
//           {step === 'code' && (
//             <>
//               <Hero eyebrow="Check your email" title="Enter your" emphasis="code.">
//                 <View style={styles.sentTo}>
//                   <Mail size={16} color={colors.muted} />
//                   <Text color="muted" style={styles.flexShrink}>
//                     Sent to {email.trim()}
//                   </Text>
//                 </View>
//               </Hero>
//               <TextField
//                 label="6-digit code"
//                 value={code}
//                 onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
//                 placeholder="000000"
//                 keyboardType="number-pad"
//                 autoComplete="one-time-code"
//                 textContentType="oneTimeCode"
//                 autoFocus
//                 onSubmitEditing={() => code.length === 6 && void submitCode()}
//                 error={error}
//                 style={styles.code}
//               />
//               <Button label="Continue" trailingIcon={ArrowRight} fullWidth loading={busy} disabled={code.length !== 6} onPress={submitCode} />
//               <Button label="Back" variant="ghost" leadingIcon={ArrowLeft} onPress={() => go(purpose === 'signUp' ? 'signUp' : 'signIn')} />
//             </>
//           )}
//
//           {step === 'newPassword' && (
//             <>
//               <Hero eyebrow="Reset password" title="Choose a new" emphasis="password." />
//               <TextField
//                 label="New password"
//                 value={password}
//                 onChangeText={setPassword}
//                 secureTextEntry
//                 autoComplete="new-password"
//                 textContentType="newPassword"
//                 autoFocus
//                 returnKeyType="go"
//                 onSubmitEditing={() => password && void submitNewPassword()}
//                 error={error}
//               />
//               <Button label="Save and sign in" trailingIcon={ArrowRight} fullWidth loading={busy} disabled={!password} onPress={submitNewPassword} />
//             </>
//           )}
//         </ScrollView>
//       </KeyboardAvoidingView>
//     </SafeAreaView>
//   );
// }
//
// function Hero({ eyebrow, title, emphasis, body, children }: { eyebrow: string; title: string; emphasis: string; body?: string; children?: ReactNode }) {
//   return (
//     <View style={styles.hero}>
//       <Text variant="eyebrow">{eyebrow}</Text>
//       <Text variant="h1">
//         {title}{' '}
//         <Text variant="h1" emphasis>
//           {emphasis}
//         </Text>
//       </Text>
//       {body ? <Text color="muted">{body}</Text> : null}
//       {children}
//     </View>
//   );
// }
//
// function Divider() {
//   return (
//     <View style={styles.divider}>
//       <View style={styles.rule} />
//       <Text variant="caption" color="muted">
//         or
//       </Text>
//       <View style={styles.rule} />
//     </View>
//   );
// }
//
// const styles = StyleSheet.create({
//   safe: { flex: 1 },
//   flex: { flex: 1 },
//   flexShrink: { flexShrink: 1 },
//   body: { paddingHorizontal: screenPadding, paddingTop: space.xl, paddingBottom: space['3xl'], gap: space.lg },
//   hero: { gap: space.md, marginTop: space['2xl'], marginBottom: space.sm },
//   divider: { flexDirection: 'row', alignItems: 'center', gap: space.md },
//   rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
//   sentTo: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
//   code: { fontFamily: fonts.mono, fontSize: 22, letterSpacing: 6 },
// });
