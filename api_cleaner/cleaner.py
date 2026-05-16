"""
FormCleaner - Remove pen handwriting from photographed printed forms.
Supports blue, red, green and black (experimental) ink detection.
"""

import cv2
import numpy as np
from PIL import Image
import img2pdf
import io
import os


# ── Perspective correction ────────────────────────────────────────────────────

def order_points(pts: np.ndarray) -> np.ndarray:
    """Order corner points: TL, TR, BR, BL."""
    rect = np.zeros((4, 2), dtype=np.float32)
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1)
    rect[0] = pts[np.argmin(s)]   # top-left
    rect[2] = pts[np.argmax(s)]   # bottom-right
    rect[1] = pts[np.argmin(d)]   # top-right
    rect[3] = pts[np.argmax(d)]   # bottom-left
    return rect


def correct_perspective(img: np.ndarray) -> tuple[np.ndarray, bool]:
    """
    Detect the document outline and apply a perspective transform.
    Returns (corrected_image, success_flag).
    """
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Edge detection with auto Canny thresholds
    median = np.median(blurred)
    lo = int(max(0, 0.67 * median))
    hi = int(min(255, 1.33 * median))
    edges = cv2.Canny(blurred, lo, hi)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)

    doc_cnt = None
    for c in contours[:10]:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        area = cv2.contourArea(approx)
        if len(approx) == 4 and area > 0.10 * h * w:
            doc_cnt = approx
            break

    if doc_cnt is None:
        return img, False

    pts = doc_cnt.reshape(4, 2).astype(np.float32)
    rect = order_points(pts)
    tl, tr, br, bl = rect

    max_w = max(
        int(np.linalg.norm(br - bl)),
        int(np.linalg.norm(tr - tl))
    )
    max_h = max(
        int(np.linalg.norm(tr - br)),
        int(np.linalg.norm(tl - bl))
    )

    if max_w < 100 or max_h < 100:
        return img, False

    dst = np.array([[0, 0], [max_w - 1, 0],
                    [max_w - 1, max_h - 1], [0, max_h - 1]], dtype=np.float32)

    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(img, M, (max_w, max_h),
                                 flags=cv2.INTER_LANCZOS4)
    return warped, True


# ── Handwriting mask ──────────────────────────────────────────────────────────

def _dilate(mask: np.ndarray, r: int = 2) -> np.ndarray:
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    return cv2.dilate(mask, k, iterations=1)


def _hsv_mask(hsv: np.ndarray, lo: tuple, hi: tuple) -> np.ndarray:
    return cv2.inRange(hsv, np.array(lo, np.uint8), np.array(hi, np.uint8))


def detect_colored_ink(img: np.ndarray, color: str) -> np.ndarray:
    """Return binary mask for colored ink regions."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    mask = np.zeros(img.shape[:2], np.uint8)

    ranges = {
        "blue":   [((95, 35, 30), (135, 255, 255))],
        "red":    [((0, 40, 40), (12, 255, 255)),
                   ((168, 40, 40), (180, 255, 255))],
        "green":  [((38, 40, 40), (82, 255, 255))],
        "purple": [((120, 30, 30), (155, 255, 255))],
    }

    for lo, hi in ranges.get(color, []):
        mask = cv2.bitwise_or(mask, _hsv_mask(hsv, lo, hi))

    # Remove almost-white and almost-black pixels (noise)
    sat = hsv[:, :, 1]
    val = hsv[:, :, 2]
    noise = cv2.inRange(sat, 0, 20)  # near-gray
    dark  = cv2.inRange(val, 0, 25)  # near-black
    mask  = cv2.bitwise_and(mask, cv2.bitwise_not(cv2.bitwise_or(noise, dark)))

    return mask


def detect_black_ink(img: np.ndarray) -> np.ndarray:
    """
    Detect black handwriting over printed text.
    Strategy: adaptive threshold → connected components → 
    reject components that look like uniform printed glyphs.
    This is a best-effort heuristic; colored ink gives better results.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Normalize illumination
    norm = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(16, 16)).apply(gray)
    # Binarize
    _, bw = cv2.threshold(norm, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Connected components
    n_labels, labels, stats, _ = cv2.connectedComponentsWithStats(bw, connectivity=8)

    h, w = gray.shape
    mask = np.zeros((h, w), np.uint8)

    for lbl in range(1, n_labels):
        x, y, cw, ch, area = (stats[lbl, cv2.CC_STAT_LEFT],
                               stats[lbl, cv2.CC_STAT_TOP],
                               stats[lbl, cv2.CC_STAT_WIDTH],
                               stats[lbl, cv2.CC_STAT_HEIGHT],
                               stats[lbl, cv2.CC_STAT_AREA])

        if area < 20:                          # too small → noise
            continue
        if area > 0.004 * h * w:              # too large → border/box
            continue

        aspect = max(cw, ch) / (min(cw, ch) + 1e-5)
        fill   = area / (cw * ch + 1e-5)

        # Handwriting tends to be elongated and irregular (low fill)
        if aspect > 5 or fill < 0.10:
            mask[labels == lbl] = 255

    # Clean up
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k, iterations=2)
    return mask


def build_mask(img: np.ndarray, ink: str, dilation: int = 3) -> np.ndarray:
    """
    Build the inpainting mask for the chosen ink color.
    ink: 'auto' | 'blue' | 'red' | 'green' | 'purple' | 'black'
    """
    if ink == "black":
        mask = detect_black_ink(img)
    elif ink == "auto":
        # Try colored inks; fall back to black heuristic only if negligible color found
        combined = np.zeros(img.shape[:2], np.uint8)
        for c in ("blue", "red", "green", "purple"):
            combined = cv2.bitwise_or(combined, detect_colored_ink(img, c))
        if combined.sum() / 255 < 50:          # very few colored pixels found
            mask = detect_black_ink(img)
        else:
            mask = combined
    else:
        mask = detect_colored_ink(img, ink)

    if dilation > 0:
        mask = _dilate(mask, dilation)

    return mask


# ── Inpainting ────────────────────────────────────────────────────────────────

def erase_handwriting(img: np.ndarray, mask: np.ndarray,
                       radius: int = 7) -> np.ndarray:
    """Apply Navier-Stokes inpainting to fill masked regions."""
    return cv2.inpaint(img, mask, inpaintRadius=radius, flags=cv2.INPAINT_TELEA)


# ── Document enhancement ──────────────────────────────────────────────────────

def enhance_document(img: np.ndarray) -> np.ndarray:
    """
    Improve scanned document quality:
    CLAHE contrast → gentle sharpening → slight brightness boost.
    """
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    l = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8)).apply(l)
    img = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)

    # Unsharp mask
    blurred = cv2.GaussianBlur(img, (0, 0), 2.0)
    img = cv2.addWeighted(img, 1.5, blurred, -0.5, 0)

    return img


def whiten_background(img: np.ndarray) -> np.ndarray:
    """Push near-white pixels to pure white (cleaner PDF look)."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, bg_mask = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)
    img[bg_mask == 255] = [255, 255, 255]
    return img


# ── PDF export ────────────────────────────────────────────────────────────────

def image_to_pdf_bytes(img: np.ndarray, dpi: int = 200) -> bytes:
    """Convert a BGR numpy image to PDF bytes (in-memory)."""
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    pil = Image.fromarray(rgb)
    buf = io.BytesIO()
    pil.save(buf, format="PNG", dpi=(dpi, dpi))
    buf.seek(0)
    pdf_bytes = img2pdf.convert(buf)
    return pdf_bytes


def save_pdf(img: np.ndarray, output_path: str, dpi: int = 200) -> None:
    with open(output_path, "wb") as f:
        f.write(image_to_pdf_bytes(img, dpi))


# ── Full pipeline ─────────────────────────────────────────────────────────────

def process(
    img: np.ndarray,
    ink: str = "auto",
    fix_perspective: bool = True,
    enhance: bool = True,
    whiten: bool = True,
    dilation: int = 3,
    inpaint_radius: int = 7,
) -> tuple[np.ndarray, dict]:
    """
    Full processing pipeline.
    Returns (cleaned_image, info_dict).
    """
    info = {}

    if fix_perspective:
        img, found = correct_perspective(img)
        info["perspective_corrected"] = found

    mask = build_mask(img, ink, dilation)
    info["ink_pixels_removed"] = int(mask.sum() / 255)

    img = erase_handwriting(img, mask, inpaint_radius)

    if enhance:
        img = enhance_document(img)

    if whiten:
        img = whiten_background(img)

    return img, info


def load_image_from_bytes(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Não foi possível decodificar a imagem.")
    return img
