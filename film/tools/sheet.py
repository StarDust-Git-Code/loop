"""contact sheet of stills: python tools/sheet.py <dir> <out.jpg> [cols]"""
import glob, sys
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 3
fs = sorted(glob.glob(d + '/still_*.png'), key=lambda f: float(f.split('_')[-1][:-5]))
W, H = 640, 360
ims = [Image.open(f).convert('RGB').resize((W, H)) for f in fs]
rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (cols * W, rows * H), 'white'); dr = ImageDraw.Draw(S)
for i, (im, f) in enumerate(zip(ims, fs)):
    x, y = (i % cols) * W, (i // cols) * H; S.paste(im, (x, y)); dr.rectangle([x, y, x + 64, y + 22], fill='black'); dr.text((x + 4, y + 4), f.split('_')[-1][:-5], fill='white')
S.save(out, quality=82); print(len(ims), 'stills')
