#!/usr/bin/env python3
"""Build a 1024px macOS app icon master from a square source PNG.

macOS applies the Dock/Finder squircle mask automatically. The master should be
an opaque square (no pre-cut transparent corners), per Apple HIG.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

OUTPUT_SIZE = 1024


def prepare_opaque_master(source: Image.Image, size: int) -> Image.Image:
    """Resize to square and flatten onto white (opaque RGB)."""
    rgba = source.convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    background = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    background.alpha_composite(rgba)
    return background.convert("RGB")


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare macOS app icon master PNG")
    parser.add_argument("input", type=Path, help="Square source image")
    parser.add_argument("output", type=Path, help="Output app-icon.png path")
    args = parser.parse_args()

    source = Image.open(args.input)
    master = prepare_opaque_master(source, OUTPUT_SIZE)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    master.save(args.output, format="PNG")
    print(f"Wrote {args.output} ({OUTPUT_SIZE}x{OUTPUT_SIZE}, opaque RGB for macOS mask)")


if __name__ == "__main__":
    main()
