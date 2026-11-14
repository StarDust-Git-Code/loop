"""Section 1 sound: cut the voice-over into one clip per spoken line, place each on the picture,
and turn the film's marked events into a list of the kit's click sounds.

Usage: python audio_s1.py <events.json written by the renderer>
Writes audio/s1/lineNN.wav, audio/s1/vo.place.json and audio/s1/events.json.
"""
import json
import os
import subprocess
import sys

FILM = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(FILM, 'audio', 's1')
SFX = os.path.join(FILM, 'sfx')


def fwd(p):
    return p.replace(os.sep, '/')


words = json.load(open(os.path.join(A, 'vo.words.json'), encoding='utf-8'))

# (first word index, last word index, second at which the line is spoken in the film)
LINES = [
    (0, 2, 0.55),      # It's 2 AM.
    (3, 7, 2.15),      # My AI agent is working.
    (8, 11, 4.25),     # Not on my computer.
    (12, 15, 6.55),    # Somewhere in the cloud.
    (16, 18, 8.65),    # With my passwords.
    (19, 24, 10.75),   # On a model I don't control.
    (25, 27, 13.15),   # And the bill?
    (28, 30, 14.55),   # Two hundred dollars.
    (31, 32, 16.05),   # Every month.
]
PRE, POST = 0.03, 0.10

place = []
for n, (a, b, t) in enumerate(LINES, 1):
    s0 = max(0.0, words[a]['start'] - PRE)
    nxt = words[b + 1]['start'] if b + 1 < len(words) else 1e9
    s1 = min(words[b]['end'] + POST, nxt - 0.012)
    d = s1 - s0
    out = os.path.join(A, 'line%02d.wav' % n)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '%.3f' % s0, '-t', '%.3f' % d, '-i', os.path.join(A, 'vo.mp3'),
                    '-af', 'afade=t=in:d=0.008,afade=t=out:st=%.3f:d=0.02' % (d - 0.02), '-ar', '48000', '-ac', '1', out], check=True)
    place.append({'clip': fwd(out), 't': round(t - (words[a]['start'] - s0), 3)})
    print('line%02d  %-30s speech at %5.2fs  (%.2fs long)' % (n, ' '.join(w['word'] for w in words[a:b + 1]), t, d))

GAIN = {
    'tick: key, off screen': -22, 'tick: key': -17, 'tick: the minute flips': -9,
    'pop: password taken': -8, 'switch: click': -11, 'snap: locked': -9,
    'tick: printing': -11, 'tick: another month': -10, 'snap: the bill': -8,
}
events = []
for e in json.load(open(sys.argv[1], encoding='utf-8')):
    if e.get('type') != 'sfx':
        continue
    name = e['label'].split(':')[0]
    events.append({'t': round(e['t'], 3), 'sfx': fwd(os.path.join(SFX, name + '.wav')), 'gain': GAIN.get(e['label'], -12)})

json.dump(events, open(os.path.join(A, 'events.json'), 'w'), indent=1)
json.dump(place, open(os.path.join(A, 'vo.place.json'), 'w'), indent=1)
print(len(events), 'sound events')
