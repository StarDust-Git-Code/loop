"""Forced-align a known script to a recorded voice-over (no transcription service, runs locally).

Usage: python align.py <vo.mp3> <script_tagged.txt> <out_dir>
Writes <out_dir>/words.json ([{word, start, end}]) and <out_dir>/words.js (window.VOW = [...]).
[bracket tags] in the script are left out. Uses torchaudio's WAV2VEC2_ASR_BASE_960H (downloaded once to the torch cache).
"""
import json, os, re, subprocess, sys, tempfile
import torch, torchaudio

mp3, script, out = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(out, exist_ok=True)
FF = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bin', 'ffmpeg.exe')

# 16 kHz mono wav via the local ffmpeg
wav = os.path.join(tempfile.mkdtemp(), 'vo16.wav')
subprocess.run([FF, '-v', 'error', '-y', '-i', mp3, '-ac', '1', '-ar', '16000', wav], check=True)
import numpy as np, scipy.io.wavfile as wf
sr, a = wf.read(wav)
x = torch.tensor(a.astype(np.float32) / 32768.0)[None]

# words to show (display form) and what is spoken (letters for the model)
text = re.sub(r'\[[^\]]*\]', ' ', open(script, encoding='utf-8').read())
disp = text.split()
NUM = {'2': 'TWO', '11': 'ELEVEN', 'a.m.': 'A M', 'p.m.': 'P M', 'MCP': 'M C P'}
def spoken(w):
    core = w.strip('.,!?"“”:;')
    if core in NUM: return NUM[core]
    s = core.upper().replace('’', "'").replace('-', ' ')
    return re.sub(r"[^A-Z' ]", '', s).strip()
spk = [spoken(w) for w in disp]

bundle = torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H
model = bundle.get_model().eval()
labels = bundle.get_labels()           # ('-', '|', 'E', 'T', ...): blank is 0, word gap is '|'
lid = {c: i for i, c in enumerate(labels)}

# emissions in 20 s windows with 2 s of context each side (keeps memory small)
SR, WIN, CTX = 16000, 20 * 16000, 2 * 16000
ems, n = [], x.shape[1]
with torch.inference_mode():
    for s0 in range(0, n, WIN):
        a0, a1 = max(0, s0 - CTX), min(n, s0 + WIN + CTX)
        e, _ = model(x[:, a0:a1])
        e = torch.log_softmax(e, dim=-1)[0]
        rate = e.shape[0] / (a1 - a0)            # frames per sample
        k0 = round((s0 - a0) * rate); k1 = k0 + round((min(n, s0 + WIN) - s0) * rate)
        ems.append(e[k0:k1])
em = torch.cat(ems)
sec_per_frame = n / SR / em.shape[0]

# target: words joined by '|' ; remember which token begins/ends each display word
toks, spans = [], []
for i, s in enumerate(spk):
    if not s:
        spans.append(None); continue
    parts = s.split()
    if toks: toks.append(lid['|'])
    b = len(toks)
    for j, p in enumerate(parts):
        if j: toks.append(lid['|'])
        toks += [lid[c] for c in p if c in lid]
    spans.append((b, len(toks) - 1))

ali, scores = torchaudio.functional.forced_align(em[None], torch.tensor([toks], dtype=torch.int32), blank=0)
ali = ali[0].tolist()
# frame index where each target token is first and last emitted
first, last = {}, {}
# walk the path: token k advances when a non-blank differs from the previous non-blank or follows a blank after the same token
k, last_tok, in_blank = -1, None, True
for fr, t in enumerate(ali):
    if t == 0:
        in_blank = True; continue
    if k < 0 or t != toks[k] or (in_blank and k + 1 < len(toks) and toks[k + 1] == t):
        k += 1
        first.setdefault(k, fr)
    last[k] = fr
    in_blank = False

words = []
for w, sp in zip(disp, spans):
    if sp is None:
        continue
    b, e = sp
    fb = first.get(b); fe = last.get(e, first.get(e))
    if fb is None or fe is None:
        continue
    words.append({'word': w, 'start': round(fb * sec_per_frame, 3), 'end': round((fe + 1) * sec_per_frame, 3)})

json.dump(words, open(os.path.join(out, 'words.json'), 'w', encoding='utf-8'), indent=0)
open(os.path.join(out, 'words.js'), 'w', encoding='utf-8').write('window.VOW = ' + json.dumps(words) + ';\n')
print('%d of %d words aligned, %.1f s of audio, mean score %.2f' % (len(words), len(disp), n / SR, scores.exp().mean().item()))
