#!/usr/bin/env python3
"""Generate the 1024x500 feature graphic for Google Play Store.

Brand-faithful: cream background, terracotta wordmark, coral+teal dot
motif, Nunito font from node_modules. Run from repo root.
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NUNITO_BOLD = ROOT / "node_modules/@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf"
NUNITO_SEMI = ROOT / "node_modules/@expo-google-fonts/nunito/600SemiBold/Nunito_600SemiBold.ttf"
OUT = ROOT / "artifacts/play-store-graphics/feature-graphic-1024x500.png"

W, H = 1024, 500
BG = (255, 248, 242)             # #FFF8F2 cream
TERRACOTTA = (232, 93, 58)       # #E85D3A
CORAL = (255, 107, 107)          # #FF6B6B
TEAL = (46, 196, 182)            # #2EC4B6
TEXT_SOFT = (155, 148, 144)      # #9B9490

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

logo_font = ImageFont.truetype(str(NUNITO_BOLD), 180)
tag_font = ImageFont.truetype(str(NUNITO_SEMI), 42)

# Layout: vertically centered, motif (dots) right of logo wordmark.
# Measure logo width to know where to place dots and overall horizontal center.
logo_text = "cmok"
logo_bbox = d.textbbox((0, 0), logo_text, font=logo_font)
logo_w = logo_bbox[2] - logo_bbox[0]
logo_h = logo_bbox[3] - logo_bbox[1]
logo_baseline_offset = logo_bbox[1]  # pillow's textbbox top usually has padding

dot_r = 28
dot_gap = 18
group_w = logo_w + 30 + (dot_r * 2 + dot_gap + dot_r * 2)
group_x = (W - group_w) // 2

logo_y = (H // 2) - (logo_h // 2) - logo_baseline_offset - 30  # nudge up so tagline sits comfortably below

# Wordmark
d.text((group_x, logo_y), logo_text, font=logo_font, fill=TERRACOTTA)

# Motif: coral + teal dots, vertically aligned with logo's optical center
dot_cy = (H // 2) - 30
dots_x_start = group_x + logo_w + 30
d.ellipse(
    (dots_x_start, dot_cy - dot_r, dots_x_start + dot_r * 2, dot_cy + dot_r),
    fill=CORAL,
)
d.ellipse(
    (
        dots_x_start + dot_r * 2 + dot_gap,
        dot_cy - dot_r,
        dots_x_start + dot_r * 4 + dot_gap,
        dot_cy + dot_r,
    ),
    fill=TEAL,
)

# Tagline below
tag = "codzienny znak bliskości"
tag_bbox = d.textbbox((0, 0), tag, font=tag_font)
tag_w = tag_bbox[2] - tag_bbox[0]
tag_y = logo_y + logo_h + 50
d.text(((W - tag_w) // 2, tag_y), tag, font=tag_font, fill=TEXT_SOFT)

OUT.parent.mkdir(parents=True, exist_ok=True)
img.save(OUT, "PNG", optimize=True)
print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB, {W}x{H})")
