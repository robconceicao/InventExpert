"""
Apply newly generated InventExpert icon JPGs into Expo PNG assets.

Expects in assets/images/:
  icon.jpg, android-icon-foreground.jpg, android-icon-background.jpg,
  android-icon-monochrome.jpg, splash-icon.jpg, favicon.jpg

Writes PNG counterparts used by app.json. Foreground/monochrome get real alpha.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path(__file__).resolve().parents[1] / "assets" / "images"
SIZE = 1024


def extract_mono(path: Path, dark_thresh: int = 100) -> Image.Image:
    arr = np.array(Image.open(path).convert("RGBA"))
    rgb = arr[:, :, :3].astype(np.float32)
    lum = rgb.mean(axis=2)
    border = np.concatenate(
        [
            lum[0:40, :].ravel(),
            lum[-40:, :].ravel(),
            lum[:, 0:40].ravel(),
            lum[:, -40:].ravel(),
        ]
    )
    bg = float(np.median(border))
    is_ink = lum <= dark_thresh
    out = np.zeros_like(arr)
    out[is_ink] = [0, 0, 0, 255]
    mid = (lum > dark_thresh) & (lum < bg - 30)
    out[mid, 0:3] = 0
    out[mid, 3] = np.clip((bg - 30 - lum[mid]) * 3, 0, 255).astype(np.uint8)
    print(f"{path.name}: bg={bg:.1f} mono opaque%={(out[:, :, 3] > 10).mean() * 100:.1f}")
    return Image.fromarray(out, "RGBA")


def content_bbox(im: Image.Image, alpha_min: int = 10):
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > alpha_min)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)


def center_on_canvas(im: Image.Image, size: int = SIZE, fill_ratio: float = 0.64) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bbox = content_bbox(im)
    if not bbox:
        return canvas
    cropped = im.crop(bbox)
    max_side = int(size * fill_ratio)
    scale = min(max_side / cropped.width, max_side / cropped.height)
    nw = max(1, int(cropped.width * scale))
    nh = max(1, int(cropped.height * scale))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.alpha_composite(resized, ((size - nw) // 2, (size - nh) // 2))
    return canvas


def black_to_white(im: Image.Image) -> Image.Image:
    arr = np.array(im)
    out = arr.copy()
    m = arr[:, :, 3] > 0
    out[m, 0] = 255
    out[m, 1] = 255
    out[m, 2] = 255
    return Image.fromarray(out, "RGBA")


def save_opaque(src_name: str, dst_name: str, size: int | None = None) -> None:
    im = Image.open(SRC / src_name).convert("RGBA")
    if size and im.size != (size, size):
        im = im.resize((size, size), Image.Resampling.LANCZOS)
    im.save(SRC / dst_name, "PNG", optimize=True)
    print(f"wrote {dst_name} {im.size}")


def main() -> None:
    required = [
        "icon.jpg",
        "android-icon-foreground.jpg",
        "android-icon-background.jpg",
        "android-icon-monochrome.jpg",
        "splash-icon.jpg",
        "favicon.jpg",
    ]
    for name in required:
        if not (SRC / name).exists():
            raise SystemExit(f"missing source: {SRC / name}")

    # Adaptive mono + FG (white outline from mono — real alpha, safe zone)
    mono = center_on_canvas(extract_mono(SRC / "android-icon-monochrome.jpg"), fill_ratio=0.64)
    fg = black_to_white(mono)
    mono.save(SRC / "android-icon-monochrome.png", "PNG", optimize=True)
    fg.save(SRC / "android-icon-foreground.png", "PNG", optimize=True)
    print(f"wrote android-icon-monochrome.png opaque%={(np.array(mono)[:, :, 3] > 10).mean() * 100:.1f}")
    print(f"wrote android-icon-foreground.png opaque%={(np.array(fg)[:, :, 3] > 10).mean() * 100:.1f}")

    save_opaque("icon.jpg", "icon.png", SIZE)
    save_opaque("splash-icon.jpg", "splash-icon.png", SIZE)
    save_opaque("favicon.jpg", "favicon.png", 512)
    save_opaque("android-icon-background.jpg", "android-icon-background.png", SIZE)
    print("DONE")


if __name__ == "__main__":
    main()
