#!/usr/bin/env python3
"""
Generate the PWA icons.

Pure standard library — no Pillow, no build step, in keeping with ADR-0003.
Re-run with `python3 tools/make-icons.py` after changing the colours below.

Draws a full-bleed blue square with a white map pin, antialiased by 3x3
supersampling. Full-bleed matters: Android masks icons to a circle or squircle,
and a transparent or inset background shows as an ugly letterbox.
"""

import struct
import zlib
from pathlib import Path

BG = (29, 78, 216)       # --accent, roughly
PIN = (255, 255, 255)
SIZES = {
    "icon-192.png": 192,   # Android home screen
    "icon-512.png": 512,   # splash screen / store listing
    "apple-touch-icon.png": 180,  # iOS home screen
}
OUT = Path(__file__).resolve().parent.parent / "app" / "icons"


def write_png(path, width, height, rgb_rows):
    """Minimal PNG writer: 8-bit RGB, no interlacing, filter type 0."""
    raw = b"".join(b"\x00" + bytes(row) for row in rgb_rows)

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def pin_coverage(x, y, size):
    """
    How much of the pixel at (x, y) is covered by the pin, 0.0–1.0.

    The pin is a circle with a triangle hanging off its lower half, minus a
    hole in the middle — a teardrop, built from two primitives so there is no
    path rasteriser to write.
    """
    cx = size * 0.5
    cy = size * 0.40
    r = size * 0.215
    hole = r * 0.40
    tip_y = cy + r * 2.45
    shoulder_y = cy + r * 0.52
    half_w = r * 0.80

    hits = 0
    samples = 3
    for sy in range(samples):
        for sx in range(samples):
            px = x + (sx + 0.5) / samples
            py = y + (sy + 0.5) / samples

            dist = ((px - cx) ** 2 + (py - cy) ** 2) ** 0.5
            inside = dist <= r

            if not inside and shoulder_y <= py <= tip_y:
                # Triangle narrowing from the shoulders to the tip.
                t = (py - shoulder_y) / (tip_y - shoulder_y)
                if abs(px - cx) <= half_w * (1 - t):
                    inside = True

            if inside and dist <= hole:
                inside = False  # the hole

            hits += inside
    return hits / (samples * samples)


def build(size):
    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            a = pin_coverage(x, y, size)
            for channel in range(3):
                row.append(round(BG[channel] * (1 - a) + PIN[channel] * a))
        rows.append(row)
    return rows


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, size in SIZES.items():
        write_png(OUT / name, size, size, build(size))
        print(f"wrote app/icons/{name} ({size}x{size})")


if __name__ == "__main__":
    main()
