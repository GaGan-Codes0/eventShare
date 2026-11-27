"""Builds the soundtrack for each Klickers video: a soft synthesized music bed,
shutter clicks, and a macOS `say` voiceover placed on the scene timings,
ducked under the voice and mastered to about -16 LUFS by ffmpeg.

Usage: python3 make_audio.py <work_dir>   (writes <work_dir>/preview.wav and ad.wav)
"""
import subprocess, sys, wave, os
import numpy as np

SR = 48000
VOICE = os.environ.get('VO_VOICE', 'Samantha')

TRACKS = {
    'preview': {
        'dur': 29.0, 'rate': 178, 'bpm': 96, 'shutters': [8.85],
        'lines': [
            (0.40, "Scan the code, and you're in."),
            (3.70, 'Every guest gets their own roll of shots, just like film.'),
            (7.70, "Take a photo, and it's live for everyone."),
            (11.70, 'Photos, videos and voice notes from every guest, in one album, at full quality.'),
            (17.90, "Take a selfie to find every photo you're in."),
            (21.70, 'Hosts choose the look, and approve every shot.'),
            (25.60, "Klickers. Every photo, everyone's."),
        ],
    },
    'ad': {
        'dur': 15.0, 'rate': 185, 'bpm': 112, 'shutters': [4.5],
        'lines': [
            (0.30, 'Your event. Every guest.'),
            (3.20, 'One shared camera roll.'),
            (6.20, 'Live, and at full quality.'),
            (9.20, "Find every photo you're in."),
            (12.30, 'Klickers. Free to join.'),
        ],
    },
}

def note(f, t, env):
    return (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3 * f * t)) * env

def music(dur, bpm):
    n = int(dur * SR)
    t = np.arange(n) / SR
    chords = [[220.0, 277.18, 329.63], [185.0, 220.0, 277.18], [146.83, 220.0, 293.66], [164.81, 246.94, 329.63]]  # A, F#m, D, E
    bar = 4 * 60 / bpm * 2
    out = np.zeros((n, 2))
    for i in range(int(dur / bar) + 1):
        a, b = int(i * bar * SR), min(n, int((i + 1) * bar * SR + 0.6 * SR))
        if a >= n:
            break
        tt = t[a:b] - t[a]
        env = np.minimum(1, tt / 0.9) * np.exp(-tt / (bar * 1.4))
        for k, f in enumerate(chords[i % 4]):
            s = note(f, tt, env) * 0.11
            pan = 0.35 + 0.15 * k
            out[a:b, 0] += s * (1 - pan)
            out[a:b, 1] += s * pan
    # soft arpeggio sparkle on eighth notes
    step = 60 / bpm / 2
    for j in range(int(dur / step)):
        a = int(j * step * SR)
        L = min(n - a, int(0.5 * SR))
        if L <= 0:
            break
        ch = chords[int(j * step / bar) % 4]
        f = ch[j % 3] * 2
        tt = np.arange(L) / SR
        s = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 7) * 0.05
        out[a:a + L, j % 2] += s
        out[a:a + L, 1 - j % 2] += s * 0.5
    # heartbeat pulse
    beat = 60 / bpm
    for j in range(int(dur / beat)):
        a = int(j * beat * SR)
        L = min(n - a, int(0.35 * SR))
        tt = np.arange(L) / SR
        k = np.sin(2 * np.pi * (48 + 40 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 11) * 0.22
        out[a:a + L] += k[:, None]
    fade = np.minimum(1, np.minimum(t / 0.8, (dur - t) / 1.6))[:, None]
    return out * np.clip(fade, 0, 1)

def shutter(at, n):
    out = np.zeros((n, 2))
    rng = np.random.default_rng(1)
    for off, g in ((0, 1.0), (0.07, 0.6)):
        a = int((at + off) * SR)
        L = int(0.06 * SR)
        tt = np.arange(L) / SR
        s = rng.standard_normal(L) * np.exp(-tt * 70) * 0.35 * g
        s = np.convolve(s, np.ones(6) / 6, mode='same')
        out[a:a + L] += s[:, None]
    return out

def write(path, data):
    data = np.clip(data, -1, 1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((data * 32767).astype('<i2').tobytes())

def main(work):
    os.makedirs(work, exist_ok=True)
    for name, cfg in TRACKS.items():
        n = int(cfg['dur'] * SR)
        bed = music(cfg['dur'], cfg['bpm']) + sum((shutter(s, n) for s in cfg['shutters']), np.zeros((n, 2)))
        write(f'{work}/{name}_bed.wav', bed)
        # voiceover: each line rendered by `say`, resampled, placed at its time
        inputs, filters = [], []
        for i, (at, line) in enumerate(cfg['lines']):
            aiff = f'{work}/{name}_vo{i}.aiff'
            subprocess.run(['say', '-v', VOICE, '-r', str(cfg['rate']), '-o', aiff, line], check=True)
            inputs += ['-i', aiff]
            filters.append(f'[{i}:a]aresample={SR},pan=stereo|c0=c0|c1=c0,adelay={int(at * 1000)}|{int(at * 1000)}[v{i}]')
        k = len(cfg['lines'])
        mix = ''.join(f'[v{i}]' for i in range(k))
        fc = ';'.join(filters) + f';{mix}amix=inputs={k}:normalize=0,highpass=f=90,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,apad=whole_dur={cfg["dur"]}[vo]'
        fc += f';[{k}:a]volume=0.55[bed];[bed][vo]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[duck]'
        fc += f';[vo]asplit=2[vo1][vo2];[duck][vo1]amix=inputs=2:normalize=0:weights=1 1.15,atrim=0:{cfg["dur"]},loudnorm=I=-16:TP=-1.5:LRA=9[out]'
        fc = fc.replace('[bed][vo]sidechaincompress', '[bed][vo2]sidechaincompress')
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *inputs, '-i', f'{work}/{name}_bed.wav', '-filter_complex', fc,
                        '-map', '[out]', '-ar', str(SR), '-ac', '2', f'{work}/{name}.wav'], check=True)
        print('wrote', f'{work}/{name}.wav')

if __name__ == '__main__':
    main(sys.argv[1])
