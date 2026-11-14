"""A quiet night-room bed for Section 1, made in code so the gaps between lines are not digital silence.
A low A-minor hum with slow movement and a little air. It is a placeholder for real music.

Usage: python bed_s1.py <out.wav> [seconds]
"""
import sys
import wave

import numpy as np

out = sys.argv[1]
dur = float(sys.argv[2]) if len(sys.argv) > 2 else 18.0
sr = 48000
n = int(sr * dur)
t = np.arange(n) / sr
rng = np.random.default_rng(1147)

# (frequency Hz, level, tremolo rate Hz)
PARTIALS = [(55.0, .50, .07), (82.41, .34, .05), (110.0, .24, .09), (220.0, .11, .11), (261.63, .07, .06), (329.63, .05, .08)]


def pad(detune, phase):
    x = np.zeros(n)
    for i, (f, a, r) in enumerate(PARTIALS):
        trem = 1 + .28 * np.sin(2 * np.pi * r * t + phase + i * 1.3)
        x += a * trem * np.sin(2 * np.pi * (f + detune * (i + 1) * .11) * t + phase * (i + 1))
    return x


def air():
    w = rng.standard_normal(n)
    # one-pole low-pass twice (~700 Hz) for a soft room tone
    a = np.exp(-2 * np.pi * 700 / sr)
    y = np.empty(n)
    acc = 0.0
    for k in range(n):
        acc = a * acc + (1 - a) * w[k]
        y[k] = acc
    acc = 0.0
    for k in range(n):
        acc = a * acc + (1 - a) * y[k]
        y[k] = acc
    return y / (np.abs(y).max() + 1e-9)


L = pad(0.0, 0.0) + .16 * air()
R = pad(1.0, 0.7) + .16 * air()

# a slow rise towards the bill, short fades at both ends
env = np.interp(t, [0, .5, 12.5, 15.5, dur - .25, dur], [0, .72, .8, 1.0, 1.0, 0])
st = np.stack([L, R], 1) * env[:, None]
rms = np.sqrt(np.mean(st ** 2))
st *= (10 ** (-22 / 20)) / rms          # -22 dBFS RMS; the mix turns it down further
st = np.clip(st, -1, 1)

with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(sr)
    w.writeframes((st * 32767).astype('<i2').tobytes())
print(out, '%.1fs' % dur)
