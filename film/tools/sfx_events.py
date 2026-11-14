"""Turn the film's own sfx marks (render.mjs <video>.events.json) into mix.py events, using the effect files already in film/sfx.

Usage: python tools/sfx_events.py renders/v2-draft.mp4.events.json audio/v2/events.json
A mark's label starts with its kind ("tick: ...", "pop: ...", ...). Typing ticks are kept quiet and thinned;
two marks of one kind closer than 3 frames become one.
"""
import json, os, sys

src, out = sys.argv[1], sys.argv[2]
SFX = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'sfx')
KIND = {  # kind: (file, gain dB)
    'tick': ('tick.wav', -21), 'pop': ('pop.wav', -17), 'snap': ('snap.wav', -15), 'switch': ('switch.wav', -16),
    'chime': ('chime.wav', -15), 'success': ('success.wav', -14), 'counter': ('counter.wav', -16), 'fill': ('fill.wav', -15),
}
ev = json.load(open(src, encoding='utf-8'))
ev = ev.get('events', ev) if isinstance(ev, dict) else ev
marks = sorted((e for e in ev if e.get('type') == 'sfx'), key=lambda e: e['frame'])
last, res = {}, []
for e in marks:
    label = e.get('label', '')
    kind = label.split(':')[0].strip()
    if kind not in KIND:
        continue
    typing = 'typing' in label or 'key' in label
    key = kind + ('t' if typing else '')
    if e['frame'] - last.get(key, -99) < (5 if typing else 3):
        continue
    last[key] = e['frame']
    f, g = KIND[kind]
    res.append({'t': round(e['t'], 3), 'sfx': os.path.join(SFX, f).replace('\\', '/'), 'gain': g - (6 if typing else 0)})
json.dump(res, open(out, 'w', encoding='utf-8'), indent=0)
print(len(marks), 'marks ->', len(res), 'events')
