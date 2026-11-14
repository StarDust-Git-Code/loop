"""Render a list of mix.py-style SFX events into ONE 48 kHz stereo wav (avoids a giant ffmpeg command line on Windows).

Usage: python tools/sfx_track.py audio/v2/events.json 237 audio/v2/sfx-track.wav
"""
import json, os, subprocess, sys, tempfile
import numpy as np
import scipy.io.wavfile as wf

src, dur, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
SR = 48000
FF = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bin', 'ffmpeg.exe')
cache, tmp = {}, tempfile.mkdtemp()

def load(path):
    if path not in cache:
        w = os.path.join(tmp, '%d.wav' % len(cache))
        subprocess.run([FF, '-v', 'error', '-y', '-i', path, '-ar', str(SR), '-ac', '2', '-c:a', 'pcm_f32le', w], check=True)
        cache[path] = wf.read(w)[1].astype(np.float32)
    return cache[path]

buf = np.zeros((int(dur * SR) + SR, 2), np.float32)
for e in json.load(open(src, encoding='utf-8')):
    a = load(e['sfx']) * (10 ** (e.get('gain', 0) / 20))
    i = int(round(e['t'] * SR)); n = min(len(a), len(buf) - i)
    if n > 0:
        buf[i:i + n] += a[:n]
buf = buf[:int(dur * SR)]
peak = float(np.abs(buf).max())
if peak > .98:
    buf *= .98 / peak
wf.write(out, SR, buf)
print('%d events, peak %.2f, %s' % (len(json.load(open(src))), peak, out))
