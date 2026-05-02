"""Build the downscaled preview source clip used by the interactive editor."""
from __future__ import annotations

import subprocess
from pathlib import Path


def build_preview_clip(
    *,
    src: Path,
    dst: Path,
    crop_offset: float,
    target_width: int = 540,
    target_height: int = 960,
) -> Path:
    """Crop source to 9:16 with horizontal offset, scale to target dims, no audio.

    crop_offset:  -1.0 = leftmost, 0.0 = center, +1.0 = rightmost. Clamped.
    """
    crop_offset = max(-1.0, min(1.0, crop_offset))

    # crop=ih*9/16:ih:(iw - ih*9/16)*((offset+1)/2):0
    crop_filter = (
        f"crop=ih*9/16:ih:(iw - ih*9/16)*(({crop_offset} + 1)/2):0,"
        f"scale={target_width}:{target_height}:flags=lanczos"
    )

    cmd = [
        "ffmpeg", "-y", "-i", str(src),
        "-vf", crop_filter,
        "-an",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
        "-pix_fmt", "yuv420p",
        str(dst),
    ]
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.decode(errors='replace')}")

    return dst