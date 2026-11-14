"""One continuous voice-over take from ElevenLabs v3 (audio tags in [brackets]), with word timings.

Usage: python vo.py <script.txt> <out_dir> [--voice ID] [--model eleven_v3] [--stability 0.5] [--force]
Needs ELEVENLABS_API_KEY in the environment (tools/env.sh sets it from the key file; the key is never printed).
Writes <out_dir>/vo.mp3, vo.alignment.json (raw) and vo.words.json ([{word, start, end}], tags left out).
"""
import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request

ap = argparse.ArgumentParser()
ap.add_argument('script')
ap.add_argument('out')
ap.add_argument('--voice', default='PStJ2DzQnh8zxG5PDf1s')
ap.add_argument('--model', default='eleven_v3')
ap.add_argument('--stability', type=float, default=0.5)
ap.add_argument('--speed', type=float, default=None)
ap.add_argument('--force', action='store_true')
a = ap.parse_args()

key = os.environ.get('ELEVENLABS_API_KEY', '').strip()
if not key:
    sys.exit('no ELEVENLABS_API_KEY in the environment (source tools/env.sh)')
os.makedirs(a.out, exist_ok=True)
mp3 = os.path.join(a.out, 'vo.mp3')
alj = os.path.join(a.out, 'vo.alignment.json')

if os.path.exists(mp3) and os.path.exists(alj) and not a.force:
    print('using existing take (pass --force to spend credits on a new one)')
    r = json.load(open(alj, encoding='utf-8'))
else:
    text = ' '.join(open(a.script, encoding='utf-8').read().split())
    body = {'text': text, 'model_id': a.model, 'voice_settings': {'stability': a.stability}}
    if a.speed:
        body['voice_settings']['speed'] = a.speed
    req = urllib.request.Request(
        'https://api.elevenlabs.io/v1/text-to-speech/%s/with-timestamps?output_format=mp3_44100_128' % a.voice,
        data=json.dumps(body).encode(), method='POST',
        headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'loopmates-film/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            r = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        sys.exit('ElevenLabs HTTP %d: %s' % (e.code, e.read().decode('utf-8', 'replace')[:600]))
    open(mp3, 'wb').write(base64.b64decode(r.pop('audio_base64')))
    json.dump(r, open(alj, 'w', encoding='utf-8'))
    print('new take: %d characters sent' % len(text))

al = r.get('alignment') or r.get('normalized_alignment')
ch, st, en = al['characters'], al['character_start_times_seconds'], al['character_end_times_seconds']

# words = runs of non-space characters outside [audio tags]
words, cur, depth, tags = [], None, 0, []
tag = None
for c, s, e in zip(ch, st, en):
    if c == '[':
        depth += 1
        tag = {'tag': '', 'start': s, 'end': e}
        if cur:
            words.append(cur)
            cur = None
        continue
    if c == ']':
        depth = max(0, depth - 1)
        if tag:
            tag['end'] = e
            tags.append(tag)
            tag = None
        continue
    if depth:
        if tag is not None:
            tag['tag'] += c
            tag['end'] = e
        continue
    if c.isspace():
        if cur:
            words.append(cur)
            cur = None
        continue
    if cur is None:
        cur = {'word': c, 'start': s, 'end': e}
    else:
        cur['word'] += c
        cur['end'] = e
if cur:
    words.append(cur)
words = [{'word': w['word'], 'start': round(w['start'], 3), 'end': round(w['end'], 3)} for w in words]
json.dump(words, open(os.path.join(a.out, 'vo.words.json'), 'w', encoding='utf-8'), indent=0)
json.dump(tags, open(os.path.join(a.out, 'vo.tags.json'), 'w', encoding='utf-8'), indent=0)

total = en[-1]
print('%.2f s, %d words, %.2f words/s' % (total, len(words), len(words) / total))
line, t0 = [], None
for i, w in enumerate(words):
    if t0 is None:
        t0 = w['start']
    line.append(w['word'])
    gap = (words[i + 1]['start'] - w['end']) if i + 1 < len(words) else 9
    if w['word'][-1] in '.?!"' and gap > 0.18 or gap > 0.45:
        print('%6.2f-%6.2f  %s%s' % (t0, w['end'], ' '.join(line), '   (then %.2fs)' % gap if gap < 9 else ''))
        line, t0 = [], None
print('tags:', ', '.join('%s@%.1f(%.2fs)' % (t['tag'], t['start'], t['end'] - t['start']) for t in tags))
