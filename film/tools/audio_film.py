"""Sound for the whole film: the one voice-over take at its place, the kit's clicks on the film's marked events,
and the code-made bed. Writes audio/film/events.json and prints the mix command's arguments.

Usage: python audio_film.py <events.json written by the renderer>
"""
import json
import os
import sys

FILM = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(FILM, 'audio', 'film')
SFX = os.path.join(FILM, 'sfx')
os.makedirs(OUT, exist_ok=True)


def fwd(p):
    return p.replace(os.sep, '/')


# level per sound (dB), with quieter exceptions for the busy ones
BASE = {'tick': -15, 'pop': -12, 'switch': -12, 'snap': -11, 'chime': -13, 'success': -13, 'counter': -12}
QUIET = {'tick: key, off screen': -23, 'tick: key': -19, 'tick: typing': -20, 'tick: model': -17, 'tick: another month': -12, 'pop: a Mate': -15}

events = []
for e in json.load(open(sys.argv[1], encoding='utf-8')):
    if e.get('type') != 'sfx':
        continue
    name = e['label'].split(':')[0]
    events.append({'t': round(e['t'], 3), 'sfx': fwd(os.path.join(SFX, name + '.wav')), 'gain': QUIET.get(e['label'], BASE.get(name, -14))})
json.dump(events, open(os.path.join(OUT, 'events.json'), 'w'), indent=1)
print(len(events), 'sound events')
