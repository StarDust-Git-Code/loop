"""Tighten one voice-over take: shorten the silent gaps, then speed the whole take up slightly (pitch kept).
Nothing is re-recorded and no line is moved on its own; sighs, laughs and breaths are sound, so they stay.

Usage: python tighten.py <vo_dir> [--cap 0.16] [--tempo 1.10]
Reads vo.mp3 + vo.words.json, writes vo.tight.wav + vo.tight.words.json (times in the tightened audio).
"""
import argparse
import json
import os
import subprocess
import wave

import numpy as np

import re
import shutil

FFMPEG_BIN = shutil.which('ffmpeg') or r'C:\Users\irsha\Desktop\loopmates-claude\flim-copy\tools\bin\ffmpeg.exe'

ap = argparse.ArgumentParser()
ap.add_argument('dir')
ap.add_argument('--cap', type=float, default=0.16, help='longest silence left between phrases, seconds (before tempo)')
ap.add_argument('--tempo', type=float, default=1.10)
ap.add_argument('--thr', type=float, default=-42.0, help='silence threshold, dBFS')
a = ap.parse_args()

SR = 48000
# a longer breath is kept after these words (ends of story beats), seconds before tempo
BREATHS = {'month': .42, 'month!': .42, 'skill': .40, 'skill.': .40, 'loop': .30, 'loop.': .30, 'done': .30, 'done.': .30, 'remembered': .30, 'remembered.': .30, 'too': .36, 'too.': .36, 'machine': .22, 'machine.': .22, 'waiting': .42, 'waiting.': .42, "don't": .50, "don't.": .50, 'brain': .22, 'brain.': .22, 'bill': .26, 'bill?': .26}

raw = subprocess.run([FFMPEG_BIN, '-v', 'error', '-i', os.path.join(a.dir, 'vo.mp3'), '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype=np.float32).copy()
words = json.load(open(os.path.join(a.dir, 'vo.words.json'), encoding='utf-8'))

hop = SR // 100                                     # 10 ms
nfr = len(x) // hop
rms = np.sqrt(np.mean(x[:nfr * hop].reshape(nfr, hop) ** 2, axis=1) + 1e-12)
silent = 20 * np.log10(rms) < a.thr

runs, i = [], 0
while i < nfr:
    if silent[i]:
        j = i
        while j < nfr and silent[j]:
            j += 1
        runs.append((i * hop / SR, j * hop / SR))
        i = j
    else:
        i += 1


def cap_for(t0):
    """Allowed length of the silence that starts at t0: longer if it follows the end of a story beat."""
    prev = [w for w in words if w['start'] <= t0]
    if not prev:
        return 0.06                                   # lead-in before the first word
    return BREATHS.get(prev[-1]['word'].lower().strip('"'), a.cap)


cuts = []                                             # (start, end) removed, in source seconds
for s, e in runs:
    c = cap_for(s)
    if e - s > c + 0.03:
        cuts.append((s + c / 2, e - c / 2))

# keep everything outside the cuts, 6 ms crossfades at the joins
xf = int(SR * 0.006)
keep, pos = [], 0.0
for s, e in cuts:
    keep.append((pos, s))
    pos = e
keep.append((pos, len(x) / SR))
out = np.zeros(0, dtype=np.float32)
for k, (s, e) in enumerate(keep):
    seg = x[int(s * SR):int(e * SR)].copy()
    if k and len(out) >= xf and len(seg) >= xf:
        fade = np.linspace(0, 1, xf, dtype=np.float32)
        out[-xf:] = out[-xf:] * (1 - fade) + seg[:xf] * fade
        seg = seg[xf:]
    out = np.concatenate([out, seg])


def remap(t):
    gone = 0.0
    for s, e in cuts:
        if t >= e:
            gone += e - s
        elif t > s:
            gone += t - s
    return (t - gone) / a.tempo


tmp = os.path.join(a.dir, '_tight_raw.wav')
with wave.open(tmp, 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(out, -1, 1) * 32767).astype('<i2').tobytes())
dst = os.path.join(a.dir, 'vo.tight.wav')
subprocess.run([FFMPEG_BIN, '-y', '-v', 'error', '-i', tmp, '-af', 'atempo=%.4f' % a.tempo, '-ar', str(SR), '-ac', '1', dst], check=True)
os.remove(tmp)

tw = [{'word': w['word'], 'start': round(remap(w['start']), 3), 'end': round(remap(w['end']), 3)} for w in words]
json.dump(tw, open(os.path.join(a.dir, 'vo.tight.words.json'), 'w', encoding='utf-8'), indent=0)

with open(os.path.join(a.dir, 'words.js'), 'w', encoding='utf-8') as fh:   # the film page loads this
    fh.write('window.VOW = ' + json.dumps(tw) + ';' + chr(10))
total = len(out) / SR / a.tempo
removed = sum(e - s for s, e in cuts)
print('source %.2fs  ->  silence removed %.2fs in %d places  ->  tempo x%.2f  ->  %.2fs   (%.2f words/s)' % (len(x) / SR, removed, len(cuts), a.tempo, total, len(tw) / total))
line, t0 = [], None
for i, w in enumerate(tw):
    if t0 is None:
        t0 = w['start']
    line.append(w['word'])
    gap = (tw[i + 1]['start'] - w['end']) if i + 1 < len(tw) else 9
    if w['word'][-1] in '.?!"' or gap > 0.3:
        print('%6.2f-%6.2f  %s' % (t0, w['end'], ' '.join(line)))
        line, t0 = [], None
