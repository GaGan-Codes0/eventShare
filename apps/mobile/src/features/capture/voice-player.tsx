import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Mic, Pause, Play } from 'lucide-react-native';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { makeStyles } from '@/theme';
import { clock } from '@/utils/format';

const LIGHT = '#F4F2DF';

/** A voice note: a big play / pause button, its length and how far it's played. */
export function VoicePlayer({ uri, durationMs, style, light = true }: { uri: string; durationMs: number; style?: StyleProp<ViewStyle>; light?: boolean }) {
  const styles = useStyles();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const total = status.duration > 0 ? status.duration * 1000 : durationMs;
  const at = status.currentTime * 1000;
  const color = light ? LIGHT : '#273C32';

  function toggle() {
    if (status.playing) return player.pause();
    // Played to the end: start again.
    if (status.didJustFinish || (total > 0 && at >= total - 200)) void player.seekTo(0);
    player.play();
  }

  return (
    <View style={[styles.voice, style]}>
      <View style={[styles.mic, { borderColor: light ? 'rgba(244,242,223,0.35)' : 'rgba(39,60,50,0.25)' }]}>
        <Mic size={26} color={color} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause the voice note' : 'Play the voice note'}
        onPress={toggle}
        style={[styles.play, { backgroundColor: color }]}>
        {status.playing ? <Pause size={22} color={light ? '#0B0F0D' : '#FFFFFF'} fill={light ? '#0B0F0D' : '#FFFFFF'} /> : <Play size={22} color={light ? '#0B0F0D' : '#FFFFFF'} fill={light ? '#0B0F0D' : '#FFFFFF'} />}
      </Pressable>
      <View style={[styles.track, { backgroundColor: light ? 'rgba(244,242,223,0.2)' : 'rgba(39,60,50,0.15)' }]}>
        <View style={[styles.fill, { backgroundColor: color, width: `${total ? Math.min(100, (at / total) * 100) : 0}%` }]} />
      </View>
      <Text style={[styles.time, { color }]}>
        {clock(at)} / {clock(total)}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(({ fonts }) => ({
  voice: { alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space['2xl'] },
  mic: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  play: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  track: { alignSelf: 'stretch', height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
  time: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 16 },
}));
