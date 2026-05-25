#!/usr/bin/env python3
"""Run once to generate the three tray icon PNG files."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).parent

ICONS = {
    "icon_green.png":  (34, 197, 94),
    "icon_yellow.png": (234, 179, 8),
    "icon_red.png":    (239, 68, 68),
}

for filename, colour in ICONS.items():
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([4, 4, 60, 60], fill=(*colour, 255))
    draw.ellipse([18, 18, 46, 46], fill=(255, 255, 255, 200))
    draw.ellipse([22, 22, 42, 42], fill=(*colour, 255))
    img.save(OUT / filename)
    print(f"Created {filename}")
