"""Generate optimized InventExpert app icons (PNG + alpha) for Expo/Android."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "images"
BLUE = (0, 122, 255, 255)  # #007AFF


def load(name: str) -> Image.Image:
    im = Image.open(SRC / name).convert("RGBA")
    print(f"load {name}: {im.size} {im.mode}")
    return im


def extract_white_icon(im: Image.Image, thresh: int = 200) -> Image.Image:
    """White strokes on any bg -> white on transparent."""
    arr = np.array(im)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    lum = (r.astype(np.int16) + g.astype(np.int16) + b.astype(np.int16)) / 3
    white = (
        (lum >= thresh)
        & (np.abs(r.astype(int) - g.astype(int)) < 40)
        & (np.abs(g.astype(int) - b.astype(int)) < 40)
    )
    out = np.zeros_like(arr)
    out[white] = [255, 255, 255, 255]
    return Image.fromarray(out, "RGBA")


def extract_black_icon(im: Image.Image, thresh: int = 80) -> Image.Image:
    """Black strokes on any bg -> black on transparent."""
    arr = np.array(im)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    lum = (r.astype(np.int16) + g.astype(np.int16) + b.astype(np.int16)) / 3
    black = (
        (lum <= thresh)
        & (np.abs(r.astype(int) - g.astype(int)) < 50)
        & (np.abs(g.astype(int) - b.astype(int)) < 50)
    )
    out = np.zeros_like(arr)
    out[black] = [0, 0, 0, 255]
    return Image.fromarray(out, "RGBA")


def opaque_count(im: Image.Image) -> int:
    return int((np.array(im)[:, :, 3] > 10).sum())


def content_bbox(im: Image.Image, alpha_min: int = 10):
    arr = np.array(im)
    a = arr[:, :, 3]
    ys, xs = np.where(a > alpha_min)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)


def center_on_canvas(
    im: Image.Image,
    size: int = 1024,
    fill_ratio: float = 0.62,
    bg=None,
) -> Image.Image:
    """Place icon centered with safe zone (fill_ratio of canvas)."""
    if bg is None:
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    else:
        canvas = Image.new("RGBA", (size, size), bg)

    bbox = content_bbox(im)
    if not bbox:
        return canvas

    cropped = im.crop(bbox)
    max_side = int(size * fill_ratio)
    cw, ch = cropped.size
    scale = min(max_side / cw, max_side / ch)
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (size - nw) // 2
    y = (size - nh) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas


def main() -> None:
    # Prefer FG layer (clipboard only). Fall back to main icon.
    if (SRC / "android-icon-foreground.jpg").exists():
        fg_src = load("android-icon-foreground.jpg")
    elif (SRC / "android-icon-foreground.png").exists():
        fg_src = load("android-icon-foreground.png")
    else:
        raise SystemExit("missing foreground source")

    if (SRC / "android-icon-monochrome.jpg").exists():
        mono_src = load("android-icon-monochrome.jpg")
    elif (SRC / "android-icon-monochrome.png").exists():
        mono_src = load("android-icon-monochrome.png")
    else:
        mono_src = fg_src

    if (SRC / "icon.jpg").exists():
        icon_src = load("icon.jpg")
    elif (SRC / "icon.png").exists():
        icon_src = load("icon.png")
    else:
        icon_src = fg_src

    fg_white = extract_white_icon(fg_src, thresh=190)
    icon_white = extract_white_icon(icon_src, thresh=210)
    print("fg opaque", opaque_count(fg_white), "icon opaque", opaque_count(icon_white))

    base_white = fg_white if opaque_count(fg_white) > 1000 else icon_white

    mono_black = extract_black_icon(mono_src, thresh=90)
    if opaque_count(mono_black) < 1000:
        arr = np.array(base_white)
        out = np.zeros_like(arr)
        mask = arr[:, :, 3] > 10
        out[mask] = [0, 0, 0, 255]
        mono_black = Image.fromarray(out, "RGBA")

    # Adaptive FG / mono with safe zone (~62%)
    fg_png = center_on_canvas(base_white, 1024, fill_ratio=0.62)
    mono_png = center_on_canvas(mono_black, 1024, fill_ratio=0.62)
    bg_png = Image.new("RGBA", (1024, 1024), BLUE)

    # Main launcher icon: solid #007AFF + white glyph, NO text
    icon_png = center_on_canvas(base_white, 1024, fill_ratio=0.66, bg=BLUE)
    # Splash: same brand mark, a bit more margin
    splash_png = center_on_canvas(base_white, 1024, fill_ratio=0.55, bg=BLUE)
    # Favicon
    favicon_png = center_on_canvas(base_white, 512, fill_ratio=0.72, bg=BLUE)

    targets = {
        "android-icon-foreground.png": fg_png,
        "android-icon-monochrome.png": mono_png,
        "android-icon-background.png": bg_png,
        "icon.png": icon_png,
        "splash-icon.png": splash_png,
        "favicon.png": favicon_png,
    }
    for name, im in targets.items():
        path = SRC / name
        im.save(path, "PNG", optimize=True)
        alpha_pct = 100 * (np.array(im)[:, :, 3] > 0).mean()
        print(f"wrote {path.name} {im.size} alpha%={alpha_pct:.1f}")

    for j in (
        "android-icon-foreground.jpg",
        "android-icon-monochrome.jpg",
        "android-icon-background.jpg",
        "icon.jpg",
        "splash-icon.jpg",
        "favicon.jpg",
    ):
        p = SRC / j
        if p.exists():
            p.unlink()
            print("removed", p.name)

    print("DONE")


if __name__ == "__main__":
    main()
