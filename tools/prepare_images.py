#!/usr/bin/env python3
"""
prepare_images.py - get your own image files ready for the planner.

What it does
  * scans a folder with your original images (default: ./raw_images, including sub folders)
  * works out which resonator / weapon / currency each file is from its file name
  * crops and shrinks it to the size the site needs (small files = fast page)
  * saves it as images/<category>/<name>.png with exactly the file name the site looks for

Folder layout for the originals (the first run creates it for you):
    raw_images/resonators/   any file names: "Jinhsi.png", "T_IconRoleHead256_Jinhsi.png", "Jinhsi Splash Art.jpg" ...
    raw_images/weapons/      any file names: "Emerald of Genesis.png" -> emeraldofgenesis.png
    raw_images/currency/     "Astrite.png", "Lunite.png", "Radiant Tide.png", "Forging Tide.png"
    raw_images/echosets/     echo set icons: "Moonlit Clouds.png", "Icon_Moonlit_Clouds.webp" -> moonlitclouds.png
Files that are not in one of these folders are sorted automatically when they are a resonator or a
currency; weapons always need the weapons folder (or --cat weapons).

Usage
    py tools/prepare_images.py                     (reads ./raw_images)
    py tools/prepare_images.py "C:/path/to/folder"
    py tools/prepare_images.py --dry-run           (only show what would happen, writes nothing)
Needs Pillow once:  py -m pip install pillow
"""

import argparse
from urllib.parse import unquote
import difflib
import re
import sys
import unicodedata
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:  # pragma: no cover
    print("Pillow is missing. Install it once with:   py -m pip install pillow")
    sys.exit(1)

try:  # Windows consoles: avoid crashes on special characters
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}
CATS = ("resonators", "weapons", "currency", "echosets")
ELEMENTS = ("aero", "electro", "havoc", "spectro")  # Rover variants
CURRENCY = {  # keyword in the file name -> file name the site expects
    "astrite": "astrite",
    "lunite": "lunite",
    "radiant": "radiant",
    "forging": "forging",
}
# extra spellings -> the key the site uses
ALIASES = {
    "xuanling": "yangyangxuanling",
    "luuk": "luukherssen",
    "xiangli": "xiangliyao",
    "jinshi": "jinhsi",
}
# words that only describe the file, not the item
NOISE = {
    "t", "ui", "icon", "icons", "splash", "art", "arts", "full", "card", "portrait", "resonator", "resonators",
    "avatar", "head", "role", "rolehead", "character", "char", "image", "img", "large", "small", "big", "hd",
    "wiki", "new", "banner", "gacha", "weapon", "weapons", "item", "items", "tide", "tides", "png", "jpg",
    "webp", "copy", "final", "render", "sprite", "half", "bust", "wallpaper", "the",
}
# echo set icons: only strip words that describe the file ("Set Moonlit Clouds Icon.png")
ECHO_NOISE = {"t", "ui", "icon", "icons", "set", "sets", "sonata", "echo", "png", "jpg", "webp", "copy", "final",
              "render", "sprite", "hd", "wiki", "large", "small"}
# weapon names often contain "The", "Tide", "Art" ... so only strip words that clearly describe the file
WEAPON_NOISE = {"t", "ui", "icon", "icons", "splash", "weapon", "weapons", "png", "jpg", "webp", "copy", "final",
                "render", "sprite", "hd", "wiki", "large", "small"}


def norm_key(s: str) -> str:
    """Same rule as normKey() in app.js: lower case, letters and digits only."""
    s = unicodedata.normalize("NFKD", str(s or ""))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", s.lower())


def tokens_of(stem: str, noise=None, keep_digits=False) -> list:
    """File name -> useful words (camelCase and separators split, noise words and numbers dropped)."""
    noise = NOISE if noise is None else noise
    stem = unquote(stem)  # wiki downloads: "Bloodpact%27s_Pledge" -> "Bloodpact's_Pledge", "Lux_%26_Umbra" -> "Lux_&_Umbra"
    s = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", stem)  # IconRoleHead256Yangyang -> Icon Role Head256 Yangyang
    out = []
    for t in re.split(r"[^A-Za-z0-9]+", s):
        t = t.lower()
        if not t:
            continue
        if not keep_digits:  # weapon names can contain numbers: "Broadblade#41", "Gauntlets#21D"
            if re.fullmatch(r"\d+(x\d+)?|v\d+", t):  # 256, 256x256, v2
                continue
            t = re.sub(r"\d+$", "", t)  # head256 -> head
        if t and t not in noise:
            out.append(t)
    return out


# ---------------------------------------------------------------- resonator list
def load_resonators() -> list:
    """Names from teams.js (RESONATORS) so new characters are picked up; falls back to the images README."""
    names = []
    tj = ROOT / "teams.js"
    if tj.exists():
        txt = tj.read_text(encoding="utf-8", errors="replace")
        m = re.search(r"const RESONATORS\s*=\s*\[(.*?)\n\]", txt, re.S)
        if m:
            names = re.findall(r'\["([^"]+)",\s*[45]\s*,', m.group(1))
    if not names:
        rd = ROOT / "images" / "resonators" / "README.md"
        if rd.exists():
            names = re.findall(r"^\|\s*([^|`]+?)\s*\|\s*`", rd.read_text(encoding="utf-8"), re.M)
    return names


class Matcher:
    def __init__(self, names):
        self.keys = sorted({norm_key(n) for n in names})
        self.pairs = [(k, k, False) for k in self.keys]
        self.pairs += [(a, t, True) for a, t in ALIASES.items() if t in self.keys]
        # longest first; on a tie the alias wins (it is the more specific hint)
        self.pairs.sort(key=lambda p: (-len(p[0]), not p[2]))

    def resonator(self, toks):
        """-> (key, how) with how in exact/alias/contains/fuzzy, or (None, reason)."""
        joined = "".join(toks)
        if not joined:
            return None, "empty"
        if "rover" in joined:
            el = [e for e in ELEMENTS if e in joined]
            if len(el) == 1:
                return "rover" + el[0], "exact"
            if not el:
                return "rover", "exact"  # one shared picture for all four Rovers
            return None, "more than one element in the file name (Aero / Electro / Havoc / Spectro)"
        if joined in self.keys:
            return joined, "exact"
        for mk, target, is_alias in self.pairs:
            if len(mk) >= 4 and mk in joined:
                return target, "alias" if is_alias else "contains"
        close = difflib.get_close_matches(joined, self.keys, n=1, cutoff=0.82)
        if close:
            return close[0], "fuzzy"
        return None, "no match"

    def suggest(self, toks):
        joined = "".join(toks)
        return difflib.get_close_matches(joined, self.keys, n=3, cutoff=0.6)


# ---------------------------------------------------------------- image handling
def has_alpha(im):
    if im.mode in ("RGBA", "LA"):
        return im.getchannel("A").getextrema()[0] < 255
    return "transparency" in im.info


def load_image(path: Path):
    im = Image.open(path)
    im = ImageOps.exif_transpose(im)
    alpha = has_alpha(im)
    return im.convert("RGBA" if alpha else "RGB"), alpha


def crop_ratio(im, ratio_w, ratio_h, ax, ay):
    """Crop to ratio_w:ratio_h like CSS 'object-fit: cover'. ax/ay: 0 = left/top, 0.5 = centre, 1 = right/bottom."""
    w, h = im.size
    target = ratio_w / ratio_h
    if w / h > target:  # too wide -> cut the sides
        nw = round(h * target)
        x = round((w - nw) * ax)
        return im.crop((x, 0, x + nw, h))
    nh = round(w / target)  # too tall -> cut bottom (or top)
    y = round((h - nh) * ay)
    return im.crop((0, y, w, y + nh))


def pick_figure(im, side):
    """Picture with two figures side by side (e.g. Rover male + female): keep only the left or right one.
    Needs a transparent background. Returns (image, True if a figure was cut out)."""
    if im.mode != "RGBA":
        return im, False
    w, h = im.size
    mask = im.getchannel("A").point(lambda v: 255 if v > 40 else 0)
    cols = mask.resize((w, 1), Image.BOX).tobytes()  # > 0 where a column has any visible pixel
    runs, start = [], None
    for x in range(w):
        on = cols[x] > 2
        if on and start is None:
            start = x
        elif not on and start is not None:
            runs.append([start, x])
            start = None
    if start is not None:
        runs.append([start, w])
    merged = []
    for r in runs:  # join pieces that are close together (loose hair, cloth ends ...)
        if merged and r[0] - merged[-1][1] < w * 0.03:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    figs = [r for r in merged if r[1] - r[0] >= w * 0.2]
    if len(figs) < 2:
        return im, False
    a, b = figs[0] if side == "left" else figs[-1]
    pad = round(w * 0.03)
    return im.crop((max(0, a - pad), 0, min(w, b + pad), h)), True


def make_resonator(im, width, ax, ay):
    if im.width / im.height < 0.65:  # tall 9:16 character card (frame, logo on top, name at the bottom): keep only the figure
        w, h = im.size
        im = im.crop((round(w * 0.045), round(h * 0.115), round(w * 0.955), round(h * 0.80)))
    im = crop_ratio(im, 3, 4, ax, ay)
    if im.width > width:  # never scale up
        im = im.resize((width, round(width * 4 / 3)), Image.LANCZOS)
    return im


def make_icon(im, box):
    if max(im.size) > box:
        im.thumbnail((box, box), Image.LANCZOS)
    return im


def rel(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def main():
    ap = argparse.ArgumentParser(description="Resize and rename your own images for the WuWa planner.")
    ap.add_argument("source", nargs="?", default=str(ROOT / "raw_images"), help="folder with the original images")
    ap.add_argument("--out", default=str(ROOT / "images"), help="target images folder (default: ./images)")
    ap.add_argument("--cat", choices=("auto",) + CATS, default="auto", help="category for loose files (default: auto)")
    ap.add_argument("--width", type=int, default=300, help="resonator image width in px, height is 4/3 of it (default 300)")
    ap.add_argument("--anchor-x", type=float, default=0.5, help="crop position 0 (left) .. 1 (right), default 0.5")
    ap.add_argument("--anchor-y", type=float, default=0.0, help="crop position 0 (top) .. 1 (bottom), default 0 = keep the head")
    ap.add_argument("--pick", choices=("left", "right"), default="left",
                    help="Rover picture with two figures: keep the left (male) or right (female) one (default left)")
    ap.add_argument("--weapon-size", type=int, default=256, help="weapon icon box in px (default 256)")
    ap.add_argument("--echoset-size", type=int, default=128, help="echo set icon box in px (default 128)")
    ap.add_argument("--currency-size", type=int, default=128, help="currency icon box in px (default 128)")
    ap.add_argument("--dry-run", action="store_true", help="only show what would happen")
    args = ap.parse_args()

    src, out = Path(args.source), Path(args.out)
    if not src.exists():
        if Path(args.source) == ROOT / "raw_images":
            for c in CATS:
                (src / c).mkdir(parents=True, exist_ok=True)
            print(f"Created {src} with the folders resonators / weapons / currency / echosets.")
            print("Put your original images in there and run this script again.")
            return 0
        print(f"Folder not found: {src}")
        return 1

    names = load_resonators()
    if not names:
        print("Could not read the resonator list (teams.js / images/resonators/README.md missing).")
        return 1
    matcher = Matcher(names)
    all_keys = set(matcher.keys)

    files = sorted(p for p in src.rglob("*") if p.is_file() and p.suffix.lower() in EXTS)
    if not files:
        print(f"No images found in {src}")
        return 0

    plan = {}        # (cat, key) -> (path, pixels, how)
    unmatched = []   # (path, why, suggestions)
    dups = []        # (kept, skipped)
    for p in files:
        parts = [x.lower() for x in p.relative_to(src).parts[:-1]]
        cat = next((c for c in CATS if c in parts), None)
        if not cat and args.cat != "auto":
            cat = args.cat
        toks = tokens_of(p.stem)
        joined = "".join(toks)

        key, how = None, "no match"
        if cat in (None, "resonators"):
            key, how = matcher.resonator(toks)
            if key and not cat:
                cat = "resonators"
        if not key and cat in (None, "currency"):
            hit = next((v for k, v in CURRENCY.items() if k in joined), None)
            if hit:
                key, how, cat = hit, "exact", "currency"
        if not key and cat == "echosets":
            ej = "".join(tokens_of(p.stem, ECHO_NOISE, keep_digits=True))
            key, how = (ej, "exact") if ej else (None, "empty name")
        if not key and cat == "weapons":
            wj = "".join(tokens_of(p.stem, WEAPON_NOISE, keep_digits=True))
            key, how = (wj, "exact") if wj else (None, "empty name")

        if not key or not cat:
            why = how if how not in ("exact", "alias", "contains", "fuzzy") else "no match"
            if not cat and why == "no match":
                why = "not a known resonator or currency (weapons: put them in a 'weapons' folder)"
            unmatched.append((p, why, matcher.suggest(toks) if cat in (None, "resonators") else []))
            continue

        try:
            with Image.open(p) as im0:
                pixels = im0.width * im0.height
        except Exception as e:
            unmatched.append((p, f"cannot open ({e.__class__.__name__})", []))
            continue
        old = plan.get((cat, key))
        if old:
            if pixels > old[1]:
                dups.append((p, old[0]))
                plan[(cat, key)] = (p, pixels, how)
            else:
                dups.append((old[0], p))
        else:
            plan[(cat, key)] = (p, pixels, how)

    # ---- do the work
    total = 0
    done = {c: 0 for c in CATS}
    fuzzy = []
    failed = []
    two_figs = []
    for (cat, key), (p, _px, how) in sorted(plan.items()):
        dest = out / cat / f"{key}.png"
        if how == "fuzzy":
            fuzzy.append((p, dest.name))
        if args.dry_run:
            print(f"  {p.relative_to(src)}  ->  {rel(dest)}")
            done[cat] += 1
            continue
        try:
            im, alpha = load_image(p)
            if cat == "resonators":
                if key.startswith("rover"):
                    im, cut = pick_figure(im, args.pick)
                    if cut:
                        two_figs.append(p)
                im = make_resonator(im, args.width, args.anchor_x, args.anchor_y)
            else:
                im = make_icon(im, {"weapons": args.weapon_size, "echosets": args.echoset_size}.get(cat, args.currency_size))
            dest.parent.mkdir(parents=True, exist_ok=True)
            im.save(dest, "PNG", optimize=True, compress_level=9)
            total += dest.stat().st_size
            done[cat] += 1
        except Exception as e:
            failed.append((p, f"{e.__class__.__name__}: {e}"))

    # ---- report
    print()
    verb = "Would convert" if args.dry_run else "Converted"
    print(f"{verb}: " + ", ".join(f"{done[c]} {c}" for c in CATS) + (f"   (total {total / 1048576:.1f} MB)" if not args.dry_run else ""))
    if fuzzy:
        print("\nGuessed from a similar spelling - please check:")
        for p, d in fuzzy:
            print(f"  {p.name}  ->  {d}")
    if two_figs:
        print(f"\nTwo figures found in: {', '.join(q.name for q in two_figs)}  - kept the {args.pick} one"
              f" (use --pick {'right' if args.pick == 'left' else 'left'} for the other).")
    if dups:
        print("\nSeveral files for the same item - kept the bigger one:")
        for kept, skipped in dups:
            print(f"  kept {kept.name}   skipped {skipped.name}")
    if unmatched:
        print("\nNot recognised (rename the file to the character name and run again):")
        for p, why, sug in unmatched:
            print(f"  {p.relative_to(src)}   [{why}]" + (f"   did you mean: {', '.join(sug)}?" if sug else ""))
    if failed:
        print("\nFailed:")
        for p, why in failed:
            print(f"  {p.name}: {why}")

    have = {q.stem for q in (out / "resonators").glob("*.png")} | {k for (c, k) in plan if c == "resonators"}
    missing = sorted(all_keys - have)
    if "rover" in have:  # the shared picture covers every Rover
        missing = [k for k in missing if not k.startswith("rover")]
        print("\nRover: the shared picture rover.png is used for all four elements.")
    if missing:
        label = {norm_key(n): n for n in names}
        print(f"\nStill without an image ({len(missing)}): " + ", ".join(label[k] for k in missing))
    else:
        print("\nAll resonators have an image.")
    if args.dry_run:
        print("\nDry run - nothing was written.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
