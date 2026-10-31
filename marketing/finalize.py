"""Turn raw screenshots and rendered templates into the final images (final/).

    node shoot.mjs      # raw/  (needs the demo server, default http://localhost:3500)
    node render.mjs     # out/  (compositions, preview, thumbnail)
    python finalize.py  # final/
"""
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
RAW, OUT, FINAL = HERE / "raw", HERE / "out", HERE / "final"
SHOTS = FINAL / "screenshots"

ORDER = [
    ("01-features", OUT / "features.png"),
    ("02-home-live-popups", RAW / "l1-home-hero.png"),
    ("03-widget-library", OUT / "widgets.png"),
    ("04-website-overview-install", RAW / "d02-site.png"),
    ("05-editor-recent-activity", RAW / "d05-editor-activity.png"),
    ("06-editor-design-dark-preview", RAW / "d06-editor-review.png"),
    ("07-editor-display-rules-mobile", RAW / "d09-editor-email.png"),
    ("08-editor-conversion-counter", RAW / "d18-editor-counter.png"),
    ("09-widgets", RAW / "d03-widgets.png"),
    ("10-widget-gallery", RAW / "d04-gallery.png"),
    ("11-events", RAW / "d10-events.png"),
    ("12-integrations-webhooks", RAW / "d13-integrations.png"),
    ("13-testimonials-collect-and-wall", OUT / "testimonials.png"),
    ("14-testimonial-moderation", RAW / "d11-testimonials.png"),
    ("15-leads", RAW / "d12-leads.png"),
    ("16-analytics", RAW / "d14-analytics.png"),
    ("17-website-settings", RAW / "d15-settings.png"),
    ("18-pricing", RAW / "l4-pricing.png"),
    ("19-dark-mode", RAW / "l3-home-dark.png"),
    ("20-mobile", OUT / "mobile.png"),
    ("21-arabic-rtl-home", RAW / "r1-home-ar.png"),
    ("22-arabic-rtl-editor", RAW / "r4-editor-ar.png"),
    ("23-arabic-rtl-analytics", RAW / "r3-analytics-ar.png"),
    ("24-hindi-dashboard", RAW / "r6-site-hi.png"),
    ("25-admin-dashboard", RAW / "a1-admin-dashboard.png"),
    ("26-admin-websites", RAW / "a2-admin-websites.png"),
    ("27-admin-users", RAW / "a3-admin-users.png"),
    ("28-admin-plans", RAW / "a4-admin-plans.png"),
    ("29-admin-payments", RAW / "a5-admin-payments.png"),
    ("30-admin-payment-gateways", RAW / "a7-admin-settings-payments.png"),
    ("31-admin-widget-branding", RAW / "a6-admin-settings-widgets.png"),
    ("32-admin-languages", RAW / "a8-admin-languages.png"),
    ("33-home-full-page", RAW / "l2-home-full.png"),
]

missing = [str(src) for _, src in ORDER if not src.exists()]
if missing:
    raise SystemExit("Missing: " + ", ".join(missing))

SHOTS.mkdir(parents=True, exist_ok=True)
for old in SHOTS.glob("*.jpg"):
    old.unlink()
for name, src in ORDER:
    Image.open(src).convert("RGB").save(SHOTS / f"{name}.jpg", "JPEG", quality=88, optimize=True, progressive=True)

Image.open(OUT / "preview-590x300.png").convert("RGB").save(FINAL / "preview-590x300.jpg", "JPEG", quality=92, optimize=True)
Image.open(OUT / "thumbnail-80x80.png").save(FINAL / "thumbnail-80x80.png", optimize=True)

thumb = (FINAL / "thumbnail-80x80.png").stat().st_size
print(f"{len(ORDER)} screenshots, thumbnail {thumb / 1024:.1f} KB")
if thumb >= 50 * 1024:
    raise SystemExit("thumbnail is over the 50 KB limit")
