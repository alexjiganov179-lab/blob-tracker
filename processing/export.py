"""Final-export pipeline: full-res streaming render + audio mux."""
from __future__ import annotations

import subprocess
from pathlib import Path
import tempfile

from processing.preview import build_preview_clip
from processing.pipeline import detect_blobs_for_clip, render_clip


def mux_audio(*, video_only: Path, audio_source: Path, dst: Path) -> Path:
    """Combine the video stream from `video_only` with the audio stream from `audio_source`.

    Try stream-copy first; fall back to AAC re-encode if the audio codec is incompatible.
    If `audio_source` has no audio stream, output silently with just the video.
    """
    base = [
        "ffmpeg", "-y",
        "-i", str(video_only),
        "-i", str(audio_source),
        "-map", "0:v:0",
        "-map", "1:a:0?",   # optional → no error if absent
        "-c:v", "copy",
        "-shortest",
    ]

    # First attempt: stream-copy audio
    cmd = base + ["-c:a", "copy", str(dst)]
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode == 0:
        return dst

    # Fallback: re-encode audio to AAC
    cmd = base + ["-c:a", "aac", "-b:a", "192k", str(dst)]
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg mux failed: {result.stderr.decode(errors='replace')}")
    return dst


def export_video(
    *,
    src: Path,
    dst: Path,
    crop_offset: float,
    detection_params: dict,
    render_params: dict,
    progress_callback=None,
) -> Path:
    """Full-resolution streaming export with audio preserved.

    Step 1: ffmpeg crops source to 9:16 at full resolution → cropped_silent.mp4
    Step 2: detect blobs across all frames (streaming)
    Step 3: render layers and encode → rendered_silent.mp4
    Step 4: mux original audio → dst
    """
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        cropped = td_path / "cropped.mp4"
        rendered = td_path / "rendered.mp4"

        # Reuse build_preview_clip with no scaling — pass through dims by reading source first.
        import cv2
        cap = cv2.VideoCapture(str(src))
        src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        cap.release()

        # 9:16 crop at full source height
        target_w = int(src_h * 9 / 16)
        # Even-number requirement for H.264
        if target_w % 2 != 0:
            target_w -= 1
        target_h = src_h if src_h % 2 == 0 else src_h - 1

        build_preview_clip(
            src=src, dst=cropped,
            crop_offset=crop_offset,
            target_width=target_w, target_height=target_h,
        )

        per_frame = detect_blobs_for_clip(cropped, detection_params)

        render_clip(
            src=cropped, dst=rendered,
            per_frame_blobs=per_frame,
            render_params=render_params,
            progress_callback=progress_callback,
        )

        mux_audio(video_only=rendered, audio_source=src, dst=dst)

    return dst