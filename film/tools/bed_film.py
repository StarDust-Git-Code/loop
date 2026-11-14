"""A simple music bed for the whole film, made in code. It is a placeholder for a real track.

Three moods, switched where the picture changes:
  night    a low A-minor hum (the problem, and the 11 pm scene)
  team     a warm A-major pad with a soft plucked pattern (Loopmates)
  morning  the same, brighter, ending on one held chord

Usage: python bed_film.py <out.wav> <seconds> <reveal_s> <home_in_s> <home_out_s> <morning_s>
"""
import sys
import wave

import numpy as np

out = sys.argv[1]
dur, t_reveal, t_home, t_home_out, t_morning = (float(x) for x in sys.argv[2:7])
sr = 48000
n = int(sr * dur)
t = np.arange(n) / sr
rng = np.random.default_rng(1147)


def hz(semis_from_a2):
    return 110.0 * 2 ** (semis_from_a2 / 12)


def air(cut=700):
    w = rng.standard_normal(n)
    a = np.exp(-2 * np.pi * cut / sr)
    y = np.empty(n)
    acc = 0.0
    for k in range(n):
        acc = a * acc + (1 - a) * w[k]
        y[k] = acc
    return y / (np.abs(y).max() + 1e-9)


def gate(t0, t1, fade=0.6):
    """1 between t0 and t1 with soft edges."""
    return np.clip((t - t0) / fade, 0, 1) * np.clip((t1 - t) / fade, 0, 1)


# ---- night hum
night = np.zeros(n)
for i, (f, a, r) in enumerate([(55.0, .50, .07), (82.41, .34, .05), (110.0, .24, .09), (220.0, .11, .11), (261.63, .07, .06), (329.63, .05, .08)]):
    night += a * (1 + .28 * np.sin(2 * np.pi * r * t + i * 1.3)) * np.sin(2 * np.pi * f * t + i)
night += .16 * air()
night_env = gate(-1, t_reveal, .5) * np.interp(t, [0, .5, 9, 12], [0, .72, .8, 1.0]) + .8 * gate(t_home, t_home_out, .8)

# ---- team pad + plucks: A, F#m, D, E, two bars each at 100 bpm
BEAT = 0.6
BAR = 4 * BEAT
CHORDS = [[0, 4, 7, 12], [-3, 0, 4, 9], [5, 9, 12, 17], [7, 11, 14, 19]]     # semitones from A2
pad = np.zeros(n)
pluck = np.zeros(n)
t_end_music = dur
bar0 = t_reveal
k = 0
while bar0 + k * 2 * BAR < t_end_music:
    c = CHORDS[k % 4]
    c0, c1 = bar0 + k * 2 * BAR, bar0 + (k + 1) * 2 * BAR
    seg = (t >= c0 - .4) & (t < c1 + .6)
    env = np.clip((t[seg] - (c0 - .4)) / .5, 0, 1) * np.clip((c1 + .6 - t[seg]) / .9, 0, 1)
    for j, s in enumerate(c):
        f = hz(s)
        pad[seg] += env * (.30 / (j + 1.4)) * (np.sin(2 * np.pi * f * t[seg]) + .35 * np.sin(2 * np.pi * 2 * f * t[seg] + j))
    # eighth-note pattern over the chord tones, one octave up
    order = [0, 2, 1, 3, 2, 1, 3, 2]
    for e in range(16):
        on = c0 + e * BEAT / 2
        if on >= t_end_music - .3:
            break
        f = hz(c[order[e % 8]] + 12)
        i0 = int(on * sr)
        m = min(n - i0, int(.7 * sr))
        if m <= 0:
            continue
        tt = np.arange(m) / sr
        pluck[i0:i0 + m] += (.5 if e % 4 else .8) * np.exp(-tt / .16) * (np.sin(2 * np.pi * f * tt) + .25 * np.sin(2 * np.pi * 2 * f * tt))
    k += 1

quiet = 1 - .85 * gate(t_home - .3, t_home_out, .7)                 # the 11 pm scene: music steps back
bright = 1 + .35 * np.clip((t - t_morning) / 1.5, 0, 1)             # morning: a little more
team_env = np.clip((t - t_reveal) / .25, 0, 1) * quiet
music = (pad * team_env + .55 * pluck * team_env * bright)
tail = np.clip((dur - t) / 1.6, 0, 1)

mono = night * night_env * .9 + music * 1.0
L = mono + .02 * np.sin(2 * np.pi * .13 * t) * mono
R = mono - .02 * np.sin(2 * np.pi * .13 * t) * mono
st = np.stack([L, R], 1) * tail[:, None]
st *= (10 ** (-22 / 20)) / np.sqrt(np.mean(st ** 2))                 # -22 dBFS RMS; the mix turns it down further
st = np.clip(st, -1, 1)
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(sr)
    w.writeframes((st * 32767).astype('<i2').tobytes())
print(out, '%.1fs' % dur)
