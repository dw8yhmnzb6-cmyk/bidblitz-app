#!/usr/bin/env python3
import json
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "test_reports" / "deployment"
REPORT_DIR.mkdir(parents=True, exist_ok=True)

PREVIEW_IMG = REPORT_DIR / "preview_home.png"
PROD_IMG = REPORT_DIR / "production_home.png"
DIFF_IMG = REPORT_DIR / "preview_vs_production_diff.png"
RESULT_JSON = REPORT_DIR / "visual_compare.json"


def main() -> int:
    if not PREVIEW_IMG.exists() or not PROD_IMG.exists():
      RESULT_JSON.write_text(json.dumps({
          "ok": False,
          "reason": "missing_input_images",
          "preview_exists": PREVIEW_IMG.exists(),
          "production_exists": PROD_IMG.exists(),
      }, indent=2))
      return 1

    preview = Image.open(PREVIEW_IMG).convert("RGBA")
    prod = Image.open(PROD_IMG).convert("RGBA")
    if preview.size != prod.size:
        prod = prod.resize(preview.size)

    diff = ImageChops.difference(preview, prod)
    bbox = diff.getbbox()
    changed_pixels = 0
    if bbox:
        histogram = diff.convert("L").histogram()
        changed_pixels = sum(count for value, count in enumerate(histogram) if value > 12)
        diff.save(DIFF_IMG)

    total_pixels = preview.size[0] * preview.size[1]
    changed_ratio = changed_pixels / total_pixels if total_pixels else 0

    payload = {
        "ok": changed_ratio < 0.08,
        "changed_pixels": changed_pixels,
        "total_pixels": total_pixels,
        "changed_ratio": round(changed_ratio, 6),
        "diff_image": str(DIFF_IMG) if DIFF_IMG.exists() else None,
    }
    RESULT_JSON.write_text(json.dumps(payload, indent=2))
    print(json.dumps(payload, indent=2))
    return 0 if payload["ok"] else 2


if __name__ == "__main__":
    raise SystemExit(main())