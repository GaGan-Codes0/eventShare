import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { ScanFace, ShieldCheck, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { useCurrentEvent } from '@/features/events/use-current-event';
import { useDeleteFaceProfile, useSetFaceProfile } from '@/services/api/hooks';
import { makeStyles, ThemeProvider, useCurrentEventTheme, useTheme } from '@/theme';

type Step = { kind: 'idle' } | { kind: 'checking' } | { kind: 'error'; message: string };

/**
 * Find my photos: a guest agrees, takes a selfie, and the album can show the photos they're in.
 * The selfie is read on this phone and deleted; only its faceprint is sent.
 */
function FindMe() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { event } = useCurrentEvent();
  const save = useSetFaceProfile(event?.id ?? '');
  const forget = useDeleteFaceProfile(event?.id ?? '');
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  if (!event) return null;
  const has = event.hasFaceProfile;

  async function takeSelfie() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setStep({ kind: 'error', message: 'eventShare needs the camera for your selfie. You can allow it in Settings.' });
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({ cameraType: ImagePicker.CameraType.front, mediaTypes: ['images'], quality: 0.9 });
    const uri = shot.assets?.[0]?.uri;
    if (shot.canceled || !uri) return;
    setStep({ kind: 'checking' });
    try {
      const { findFaces } = await import('@/features/faces/detect');
      const faces = await findFaces(uri);
      // The biggest face is you (anyone behind you is smaller).
      const face = faces.sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3])[0];
      if (!face) {
        setStep({ kind: 'error', message: 'We couldn’t see a face. Try again facing the camera, in good light.' });
        return;
      }
      await save.mutateAsync(face.embedding);
      router.back();
    } catch {
      setStep({ kind: 'error', message: 'That didn’t work. Check your connection and try again.' });
    } finally {
      const f = new File(uri);
      if (f.exists) f.delete();
    }
  }

  async function stop() {
    await forget.mutateAsync();
    router.back();
  }

  const checking = step.kind === 'checking';
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <View style={styles.icon}>
        <ScanFace size={24} color={colors.accent} />
      </View>
      <Text variant="h2">{has ? 'Finding your photos' : 'Find the photos you’re in'}</Text>
      <Text variant="body" color="muted">
        {has
          ? 'The album’s “Me” shows every photo your face is in, from guests and photographers, including ones taken later.'
          : 'Take a selfie and the album’s “Me” shows every photo your face is in, from guests and photographers.'}
      </Text>

      <View style={styles.card}>
        <ShieldCheck size={18} color={colors.accent} />
        <Text variant="caption" color="muted" style={styles.flex}>
          Your selfie stays on this phone and is deleted. Only a faceprint (a list of numbers, not a picture) is kept, for{' '}
          {event.name} only. Stop any time and it’s deleted; it also goes if the hosts turn this off.
        </Text>
      </View>

      {step.kind === 'error' && (
        <Text variant="caption" color="danger">
          {step.message}
        </Text>
      )}

      <Button
        label={checking ? 'Looking for your face…' : has ? 'Retake selfie' : 'I agree, take a selfie'}
        loading={checking}
        disabled={checking}
        onPress={takeSelfie}
        fullWidth
      />
      {has && (
        <Button label="Stop finding my photos" variant="ghost" leadingIcon={Trash2} loading={forget.isPending} onPress={stop} fullWidth />
      )}
    </ScrollView>
  );
}

/** Guest-facing, so in the event's own theme. */
export default function FindMeScreen() {
  return (
    <ThemeProvider theme={useCurrentEventTheme()}>
      <FindMe />
    </ThemeProvider>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { paddingHorizontal: space.xl, paddingTop: space['2xl'], paddingBottom: space['3xl'], gap: space.md },
  icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  card: {
    flexDirection: 'row',
    gap: space.md,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  flex: { flex: 1 },
}));
