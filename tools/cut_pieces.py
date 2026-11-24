"""Cut chess sprite sheets (3x2 grid: K Q R / B N P on a flat green or magenta background)
into transparent pieces for the game.

Default sets (green background):
  python tools/cut_pieces.py <dark_sheet> <light_sheet> public/assets/pieces
  -> wK.webp … bP.webp, plus b?-glow.webp masks of the dark set's bright veins
     (the game tints them in each opponent's colour)

A character's own set (used for that character's side only):
  python tools/cut_pieces.py --set ice <sheet> public/assets/pieces [--key magenta | green-cool] [--order rkq/bpn]
  --order: the pieces aren't in a neat K Q R / B N P grid: find each piece on its own and read them in this order
  (top row, then bottom row, left to right; k q r b n p)
  -> public/assets/pieces/ice/K.webp … P.webp, plus K-glow.webp … glow masks
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

ORDER = [['k', 'q', 'r'], ['b', 'n', 'p']]
SIZE = 320          # output canvas (px)
FILL_H = 0.94       # tallest piece fills this much of the height
FILL_W = 0.96
BASELINE = 0.985    # bottom of every piece sits here


def _grey_out(out, weight):
    """Blend pixels toward their own brightness (neutral grey) by `weight` (0..1, per pixel)."""
    lum = (0.299 * out[..., 0] + 0.587 * out[..., 1] + 0.114 * out[..., 2])[..., None]
    w = weight[..., None]
    return out * (1 - w) + lum * w


def key_green(rgb):
    """Alpha from how 'green-screen' a pixel is; remove green spill."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    dom = g - np.maximum(r, b)                      # how much greener than it is red/blue
    alpha = 1 - np.clip((dom - 18) / (70 - 18), 0, 1)
    out = rgb.copy()
    # no piece colour is greener than it is red/blue, so cap green there
    out[..., 1] = np.minimum(g, np.maximum(r, b) * 1.02)
    # anything greener than it is red can't be ivory, bone or obsidian: green-tinted cloth/smoke -> grey
    out = _grey_out(out, np.clip((g - r + 5) / 25, 0, 1))
    # see-through parts were tinted by the background: fade their colour to grey
    out = _grey_out(out, np.clip((0.95 - alpha) / 0.6, 0, 1))
    return out, alpha


def key_magenta(rgb):
    """Alpha from how 'magenta-screen' a pixel is; remove pink spill (for ice and other cool-coloured sets)."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    dom = np.minimum(r, b) - g                      # how much more red AND blue than green
    alpha = 1 - np.clip((dom - 30) / (95 - 30), 0, 1)
    out = rgb.copy()
    # pink spill = red and blue both above green; pull them back down to green
    excess = np.clip(np.minimum(r, b) - g, 0, None)
    out[..., 0] = r - excess
    out[..., 2] = b - excess * 0.6                  # keep some blue: ice is meant to be blue
    out = _grey_out(out, np.clip((0.95 - alpha) / 0.6, 0, 1) * 0.7)
    return out, alpha


def key_green_cool(rgb):
    """Green screen for blue / cyan sets (e.g. glass): like key_green, but only pixels greener than BOTH red and blue
    count as spill, so blue glass (which has more green than red) keeps its colour."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    dom = g - np.maximum(r, b)
    alpha = 1 - np.clip((dom - 18) / (70 - 18), 0, 1)
    out = rgb.copy()
    out[..., 1] = np.minimum(g, np.maximum(r, b) * 1.02)
    out = _grey_out(out, np.clip((g - np.maximum(r, b) + 5) / 25, 0, 1))
    out = _grey_out(out, np.clip((0.95 - alpha) / 0.6, 0, 1) * 0.5)
    return out, alpha


KEYS = {'green': key_green, 'green-cool': key_green_cool, 'magenta': key_magenta}


def drop_floaters(a, solid):
    """Keep the piece and anything big attached near it; erase small separate bits
    (floating sparkles, stray crystals) so they don't widen the crop or clutter the board."""
    from scipy import ndimage
    labels, n = ndimage.label(solid)
    if n <= 1:
        return a, solid
    sizes = ndimage.sum(solid, labels, range(1, n + 1))
    keep_ids = [i + 1 for i, s in enumerate(sizes) if s >= 0.12 * sizes.max()]
    keep = np.isin(labels, keep_ids)
    # soft edges and smoke near the kept parts stay; anything farther away is cleared
    near = ndimage.binary_dilation(keep, iterations=8)
    a = np.where(near, a, 0)
    return a, keep


def pieces_from(sheet_path, key='green'):
    rgb = np.asarray(Image.open(sheet_path).convert('RGB')).astype(np.float32)
    rgb, alpha = KEYS[key](rgb)
    h, w = alpha.shape
    found = {}
    for row in range(2):
        for col in range(3):
            y0, y1 = row * h // 2, (row + 1) * h // 2
            x0, x1 = col * w // 3, (col + 1) * w // 3
            a = alpha[y0:y1, x0:x1].copy()
            # connectivity uses a low threshold so thin strings/ribbons stay attached to their piece;
            # the crop box covers the solid body plus everything still attached to it
            a, keep = drop_floaters(a, a > 0.12)
            solid = keep & (a > 0.12)
            ys, xs = np.where(solid)
            if not len(ys):
                raise SystemExit(f'no piece found in cell {row},{col} of {sheet_path}')
            # bounding box of the solid part, padded a little to keep soft edges / smoke
            pad = 6
            by0, by1 = max(ys.min() - pad, 0), min(ys.max() + pad, a.shape[0] - 1)
            bx0, bx1 = max(xs.min() - pad, 0), min(xs.max() + pad, a.shape[1] - 1)
            crop_rgb = rgb[y0 + by0:y0 + by1 + 1, x0 + bx0:x0 + bx1 + 1]
            crop_a = a[by0:by1 + 1, bx0:bx1 + 1]
            found[ORDER[row][col]] = (crop_rgb, crop_a)
    return found


def pieces_auto(sheet_path, key, order):
    """Find the six pieces anywhere on the sheet (the biggest blobs), split them into a top and bottom row,
    and name them left to right by `order`, e.g. 'rkq/bpn'. Small stray bits (a lone raindrop) are ignored."""
    from scipy import ndimage
    rgb = np.asarray(Image.open(sheet_path).convert('RGB')).astype(np.float32)
    rgb, alpha = KEYS[key](rgb)
    solid = alpha > 0.12
    labels, n = ndimage.label(ndimage.binary_dilation(solid, iterations=6))
    sizes = ndimage.sum(solid, labels, range(1, n + 1))
    biggest = sorted(range(1, n + 1), key=lambda i: -sizes[i - 1])[:6]
    boxes = [ndimage.find_objects((labels == i).astype(int))[0] for i in biggest]
    cy = lambda b: (b[0].start + b[0].stop) / 2
    mid = alpha.shape[0] / 2
    rows = [sorted([b for b in boxes if cy(b) < mid], key=lambda b: b[1].start), sorted([b for b in boxes if cy(b) >= mid], key=lambda b: b[1].start)]
    names = order.split('/')
    found = {}
    for r, row in enumerate(rows):
        if len(row) != len(names[r]):
            raise SystemExit(f'expected {len(names[r])} pieces in row {r}, found {len(row)}')
        for b, t in zip(row, names[r]):
            lab = labels[b] == biggest[boxes.index(b)]
            a = np.where(lab, alpha[b], 0)
            found[t] = (rgb[b], a)
    return found


def place(crop_rgb, crop_a, scale):
    """Scale a crop and drop it on a square transparent canvas, centred, bottom on the baseline."""
    img = Image.fromarray(np.dstack([np.clip(crop_rgb, 0, 255), crop_a * 255]).astype(np.uint8), 'RGBA')
    nw, nh = max(1, round(img.width * scale)), max(1, round(img.height * scale))
    img = img.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(img, ((SIZE - nw) // 2, round(SIZE * BASELINE) - nh))
    return canvas


def glow_mask(piece, threshold=115):
    """White-on-transparent mask of a piece's brightest, least saturated parts (veins, glowing cores)."""
    a = np.asarray(piece).astype(np.float32)
    lum = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    sat = a[..., :3].max(-1) - a[..., :3].min(-1)
    m = np.clip((lum - threshold) / 70, 0, 1) * np.clip(1 - sat / 90, 0, 1) * (a[..., 3] / 255)
    out = np.zeros_like(a)
    out[..., :3] = 255
    out[..., 3] = m * 255
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def cut_set(sheet, key, order=None):
    """All six pieces of one sheet, at one shared scale so relative sizes stay as drawn."""
    found = pieces_auto(sheet, key, order) if order else pieces_from(sheet, key)
    scale = min(min(FILL_H * SIZE / c[1].shape[0], FILL_W * SIZE / c[1].shape[1]) for c in found.values())
    return {t: place(rgb, a, scale) for t, (rgb, a) in found.items()}, scale


def main_default(dark, light, out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for color, sheet in (('b', dark), ('w', light)):
        pieces, scale = cut_set(sheet, 'green')
        for t, piece in pieces.items():
            piece.save(out / f'{color}{t.upper()}.webp', quality=92, method=6)
            if color == 'b':
                glow_mask(piece).save(out / f'{color}{t.upper()}-glow.webp', quality=90, method=6)
            print(color + t.upper(), 'scale %.2f' % scale)


def main_set(name, sheet, out_root, key, order=None):
    out = Path(out_root) / name
    out.mkdir(parents=True, exist_ok=True)
    pieces, scale = cut_set(sheet, key, order)
    for t, piece in pieces.items():
        piece.save(out / f'{t.upper()}.webp', quality=92, method=6)
        # light sets (ice) only glow in their brightest cores, so use a higher threshold
        glow_mask(piece, threshold=200).save(out / f'{t.upper()}-glow.webp', quality=90, method=6)
        print(f'{name}/{t.upper()}', 'scale %.2f' % scale)


if __name__ == '__main__':
    args = sys.argv[1:]
    if args and args[0] == '--set':
        key, order = 'green', None
        if '--key' in args:
            i = args.index('--key'); key = args[i + 1]; args = args[:i] + args[i + 2:]
        if '--order' in args:
            i = args.index('--order'); order = args[i + 1]; args = args[:i] + args[i + 2:]
        main_set(args[1], args[2], args[3], key, order)
    else:
        main_default(*args[:3])
