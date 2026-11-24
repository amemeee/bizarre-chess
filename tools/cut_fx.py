"""Cut an ultimate's effect sprites out of a green-screen sheet (uses the same keying as cut_pieces.py).

  python tools/cut_fx.py [--key magenta] <sheet> <out_dir> name=x0,y0,x1,y1 [name=...]
  -> <out_dir>/<name>.webp for each box, keyed to transparency and trimmed to its contents.
  A box name ending in "~tile" is cropped exactly (not trimmed), for strips that repeat (chains).
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from cut_pieces import key_green, key_magenta

args = sys.argv[1:]
key = key_green
if args[0] == '--key':
    key = {'green': key_green, 'magenta': key_magenta}[args[1]]
    args = args[2:]
sheet, out_dir, *boxes = args
src = np.asarray(Image.open(sheet).convert('RGB')).astype(np.float32)
out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
for spec in boxes:
    name, coords = spec.split('=')
    x0, y0, x1, y1 = map(int, coords.split(','))
    rgb, alpha = key(src[y0:y1, x0:x1])
    img = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8), 'RGBA')
    tile = name.endswith('~tile')
    name = name.removesuffix('~tile')
    if tile:  # keep the full width so the ends meet; just trim empty rows
        ys = np.where(alpha.max(axis=1) > 0.05)[0]
        img = img.crop((0, ys.min(), img.width, ys.max() + 1))
    else:
        img = img.crop(img.getbbox())
    img.save(out / f'{name}.webp', quality=92)
    print(name, img.size)
