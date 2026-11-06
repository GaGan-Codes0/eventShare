import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Mic } from 'lucide-react-native';
import { useRef } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { space } from '@/constants/theme';
import { defaultTheme, makeStyles } from '@/theme';
import { clock } from '@/utils/format';

export type VoiceNote = { uri: string; durationMs: number };

/**
 * Records a voice note (AAC in an .m4a file, the phones' own high-quality preset), stopping by
 * itself when the person's remaining voice time runs out.
 */
export function useVoiceNote() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 200);
  const startedAt = useRef(0);

  async function start(leftMs: number) {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) throw new Error('Allow eventShare to use the microphone in Settings to record voice notes.');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    // If the microphone never comes up (busy in a call, or blocked), say so rather than wait forever.
    await Promise.race([
      recorder.prepareToRecordAsync(),
      new Promise((_, fail) => setTimeout(() => fail(new Error('The microphone didn’t start. Close other apps using it and try again.')), 6000)),
    ]);
    startedAt.current = Date.now();
    recorder.record({ forDuration: Math.max(1, Math.floor(leftMs / 1000)) });
  }

  async function stop(): Promise<VoiceNote | null> {
    const measured = state.durationMillis || Date.now() - startedAt.current;
    await recorder.stop();
    // Back to playback, so videos and voice notes play out loud again.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    return recorder.uri ? { uri: recorder.uri, durationMs: Math.max(1, Math.round(measured)) } : null;
  }

  return { start, stop, recording: state.isRecording, elapsedMs: state.durationMillis };
}

/** Where the viewfinder is, in Voice mode: a microphone, the time running and the time left. */
export function VoicePanel({ recording, elapsedMs, leftMs }: { recording: boolean; elapsedMs: number; leftMs: number }) {
  const styles = useStyles();
  return (
    <View style={styles.panel} accessibilityLiveRegion="polite">
      <View style={[styles.mic, recording && styles.micOn]}>
        <Mic size={30} color={recording ? '#FFFFFF' : SAGE} />
      </View>
      <Text style={styles.big}>{recording ? clock(elapsedMs) : 'Leave a voice note'}</Text>
      <Text variant="caption" align="center" style={styles.small}>
        {recording ? `${clock(Math.max(0, leftMs - elapsedMs))} left · tap the button to stop` : `${clock(leftMs)} of voice-note time left. Say a few words to the hosts.`}
      </Text>
    </View>
  );
}

const SAGE = '#CDD7AB';
const LIGHT = '#F4F2DF';

const useStyles = makeStyles(() => ({
  panel: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space['2xl'], backgroundColor: '#304538' },
  mic: { width: 76, height: 76, borderRadius: 38, borderWidth: 1, borderColor: 'rgba(205,215,171,0.35)', alignItems: 'center', justifyContent: 'center' },
  micOn: { backgroundColor: '#C2412D', borderColor: '#C2412D' },
  // eventShare's own serif, like the camera's other messages.
  big: { fontFamily: defaultTheme.fonts.serif, fontSize: 30, lineHeight: 36, color: LIGHT, textAlign: 'center' },
  small: { color: 'rgba(244,242,223,0.75)', maxWidth: 260 },
}));
