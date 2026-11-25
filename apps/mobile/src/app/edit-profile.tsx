import { updateProfileSchema, type User } from '@eventshare/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FocusStatusBar } from '@/components/focus-status-bar';
import { toast } from '@/components/toast';
import { Button, LoadingState, Text, TextField } from '@/components/ui';
import { screenPadding, space } from '@/constants/theme';
import { useMe, useUpdateProfile } from '@/services/api/hooks';
import { makeStyles, useTheme } from '@/theme';

/** The name we use until someone tells us theirs (the server's placeholder). */
const UNNAMED = 'Guest';

/**
 * Your name and email, from the profile sheet. Also offered once right after a sign-in that didn't
 * give us them (Apple's "Hide my email", or no name), with Skip for now: Apple doesn't allow making
 * people re-enter what they chose to hide, so it's always optional.
 */
export default function EditProfile() {
  const me = useMe();
  if (!me.data) return <LoadingState />;
  return <Form me={me.data} />;
}

function Form({ me }: { me: User }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  // Right after sign-in (?first=1): no back arrow, a Skip button, and both lead into the app.
  const first = useLocalSearchParams<{ first?: string }>().first === '1';
  const leave = () => (first ? router.replace('/') : router.back());
  const update = useUpdateProfile();
  const [name, setName] = useState(me.name === UNNAMED ? '' : me.name);
  const [email, setEmail] = useState(me.email ?? '');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  function save() {
    const parsed = updateProfileSchema.safeParse({ name, ...(me.emailHidden && email.trim() ? { email } : {}) });
    if (!parsed.success) {
      const issues = parsed.error.flatten().fieldErrors;
      return setErrors({ name: issues.name?.[0], email: issues.email?.[0] });
    }
    setErrors({});
    update.mutate(parsed.data, {
      onSuccess: () => {
        toast('Saved');
        leave();
      },
      onError: (e) => toast(e.message),
    });
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.screen}>
      <FocusStatusBar style="dark" />
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
        {!first && (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} onPress={() => router.back()} style={styles.back}>
            <ChevronLeft size={22} color={colors.ink} />
          </Pressable>
        )}
        <View style={styles.heading}>
          <Text variant="eyebrow">Your profile</Text>
          <Text variant="h1">Edit profile.</Text>
          <Text variant="caption" color="muted">
            Your name appears on the photos you share and to the hosts of the events you join.
            {me.emailHidden ? ' Your Apple ID email is hidden, so add one if you’d like hosts to reach you.' : ''}
          </Text>
        </View>

        <View style={styles.fields}>
          <TextField
            label="Your name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Asha Rao"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            maxLength={80}
            error={errors.name}
          />
          {me.emailHidden ? (
            <TextField
              label="Email (optional)"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="done"
              onSubmitEditing={save}
              error={errors.email}
              hint="Only hosts of events you join can see it. You still sign in with Apple."
            />
          ) : (
            <TextField label="Email" value={me.email ?? ''} editable={false} hint="The email you sign in with." style={styles.readOnly} />
          )}
        </View>

        <View style={styles.actions}>
          <Button label="Save" fullWidth loading={update.isPending} onPress={save} />
          {first && <Button label="Skip for now" variant="ghost" fullWidth onPress={leave} />}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { paddingHorizontal: screenPadding, gap: space.xl },
  back: { width: 40, height: 40, justifyContent: 'center' },
  heading: { gap: space.sm, marginTop: space.lg },
  fields: { gap: space.lg },
  readOnly: { color: colors.muted },
  actions: { gap: space.sm },
}));
