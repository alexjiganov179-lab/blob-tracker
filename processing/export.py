"""Final-export pipeline: full-res streaming render + audio mux."""
from __future__ import annotations

import subprocess
import math
from pathlib import Path
import tempfile
import numpy as np

import cv2

from processing.preview import build_preview_clip
from processing.pipeline import detect_blobs_for_clip, render_clip
from processing.detection import CentroidTracker, detect_contours, contours_to_blobs
from processing.rendering import render_frame, TrailRenderer


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

    Step 1: ffmpeg crops source to 9:16 at full resolution and streams to us
    Step 2: detect blobs, render layers, and encode to rendered_silent.mp4 (all streaming)
    Step 3: mux original audio → dst
    """
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        rendered = td_path / "rendered.mp4"

        # Determine target dimensions
        cap = cv2.VideoCapture(str(src))
        src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        cap.release()

        # 9:16 crop at full source height
        target_w = int(src_h * 9 / 16)
        # Even-number requirement for H.264
        if target_w % 2 != 0:
            target_w -= 1
        target_h = src_h if src_h % 2 == 0 else src_h - 1

        # Calculate diagonal for centroid tracker
        diagonal = math.hypot(target_w, target_h)
        tracker = CentroidTracker(frame_diagonal=diagonal)

        # Set up FFmpeg command to crop and stream frames
        crop_offset = max(-1.0, min(1.0, crop_offset))
        crop_filter = (
            f"crop=ih*9/16:ih:(iw - ih*9/16)*(({crop_offset} + 1)/2):0"
        )
        
        # FFmpeg command to read and crop the source
        input_cmd = [
            "ffmpeg",
            "-i", str(src),
            "-vf", crop_filter,
            "-f", "rawvideo",
            "-pix_fmt", "bgr24",
            "-"
        ]
        
        # FFmpeg command to encode the output
        output_cmd = [
            "ffmpeg",
            "-y",
            "-f", "rawvideo",
            "-vcodec", "rawvideo",
            "-s", f"{target_w}x{target_h}",
            "-pix_fmt", "bgr24",
            "-r", str(fps),
            "-i", "-",  # Input from stdin
            "-vcodec", "libx264",
            "-crf", "18",  # Better quality for export
            "-pix_fmt", "yuv420p",
            "-preset", "medium",  # Better quality preset for final export
            str(rendered)
        ]
        
        # Start the input pipe to read cropped frames
        input_pipe = subprocess.Popen(input_cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        
        # Start the output pipe to encode rendered frames
        output_pipe = subprocess.Popen(output_cmd, stdin=subprocess.PIPE)
        
        # Initialize trail renderer
        trail_decay = TrailRenderer.decay_from_length(
            render_params["trail"]["length_frames"]
        )
        trail = TrailRenderer(
            shape=(target_h, target_w, 3),
            decay=trail_decay,
            color=render_params["trail"]["color"],
            thickness=render_params["trail"]["thickness"],
        )
        
        try:
            for i in range(frame_count):
                # Read the next frame
                raw_frame = input_pipe.stdout.read(target_w * target_h * 3)
                if not raw_frame:
                    break
                
                # Convert to numpy array
                frame = np.frombuffer(raw_frame, np.uint8).reshape((target_h, target_w, 3))
                
                # Detect contours
                contours = detect_contours(frame, **detection_params)
                blobs = contours_to_blobs(contours, frame_shape=frame.shape)
                
                # Update tracking
                blobs = tracker.update(blobs)
                
                # Render frame
                rendered_frame = render_frame(frame, blobs, render_params, trail_renderer=trail)
                
                # Send to encoder
                output_pipe.stdin.write(rendered_frame.tobytes())
                
                if progress_callback is not None:
                    progress_callback(i + 1, frame_count)
        finally:
            input_pipe.stdout.close()
            input_pipe.wait()
            output_pipe.stdin.close()
            output_pipe.wait()

        mux_audio(video_only=rendered, audio_source=src, dst=dst)

    return dst