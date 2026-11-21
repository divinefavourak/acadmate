"""Figure and page helpers for the content pipeline (run with python -I).

  crop <pdf> <page_index> <x0> <y0> <x1> <y1> <out.png>
      Render one PDF page at 200 DPI and crop a box given as page fractions (0-1, origin top-left),
      with a small margin so a slightly-off box from the model still captures the whole figure.

  cropimg <photo> <x0> <y0> <x1> <y1> <out.png>
      Same, cropping from a booklet photo at its full resolution (after EXIF rotation).

  prep <photo> <out.jpg>
      Auto-rotate a phone photo from its EXIF orientation and shrink it to a 2000px long edge
      (Claude reads ~1.5 MP anyway; this keeps batch payloads small).

  trim <in.png> <out.png>
      Trim the white border off a rendered SVG/HTML screenshot.
"""
import sys

import numpy as np
import pypdfium2 as pdfium
from PIL import Image, ImageChops, ImageOps

DPI = 200
MARGIN = 0.02  # fraction of the page added on every side of the model's box
MAX_EDGE = 2000


def _box(w, h, x0, y0, x1, y1):
    x0, x1 = sorted((float(x0), float(x1)))
    y0, y1 = sorted((float(y0), float(y1)))
    box = (
        max(0, int((x0 - MARGIN) * w)),
        max(0, int((y0 - MARGIN) * h)),
        min(w, int((x1 + MARGIN) * w)),
        min(h, int((y1 + MARGIN) * h)),
    )
    if box[2] - box[0] < 40 or box[3] - box[1] < 40:
        raise SystemExit(f"crop box too small: {box}")
    return box


def _photo(path):
    return ImageOps.exif_transpose(Image.open(path)).convert("RGB")


def dewatermarked(img):
    """Whiten the reddish/pink publisher watermark stamped across the source PDFs.
    Question text and figures are black/grey, so strongly red-dominant pixels are safe to drop."""
    a = np.asarray(img).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # The stamp renders as faint pink, e.g. (255, 240, 240): light and red-leaning.
    mask = ((r > 180) & (r - g >= 8) & (r - b >= 8)) | ((r > 235) & (r - g >= 3) & (r - b >= 3))
    a[mask] = 255
    return Image.fromarray(a.astype(np.uint8))


def crop(pdf_path, page_index, x0, y0, x1, y1, out_path):
    pdf = pdfium.PdfDocument(pdf_path)
    img = pdf[int(page_index)].render(scale=DPI / 72).to_pil().convert("RGB")
    trimmed(dewatermarked(img.crop(_box(*img.size, x0, y0, x1, y1)))).save(out_path, optimize=True)


def cropimg(photo_path, x0, y0, x1, y1, out_path):
    img = _photo(photo_path)
    trimmed(img.crop(_box(*img.size, x0, y0, x1, y1))).save(out_path, optimize=True)


def prep(photo_path, out_path):
    img = _photo(photo_path)
    img.thumbnail((MAX_EDGE, MAX_EDGE))
    img.save(out_path, "JPEG", quality=85, optimize=True)


def trimmed(img):
    bg = Image.new(img.mode, img.size, (255, 255, 255))
    bbox = ImageChops.difference(img, bg).convert("L").point(lambda p: 255 if p > 12 else 0).getbbox()
    if not bbox:
        return img
    pad = 12
    return img.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(img.width, bbox[2] + pad), min(img.height, bbox[3] + pad)))


def trim(in_path, out_path):
    trimmed(Image.open(in_path).convert("RGB")).save(out_path, optimize=True)


if __name__ == "__main__":
    cmd, *args = sys.argv[1:]
    {"crop": crop, "cropimg": cropimg, "prep": prep, "trim": trim}[cmd](*args)
