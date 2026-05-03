"""Streaming detect+render pipelines for preview and export paths."""
from __future__ import annotations

import math
from pathlib import Path
import subprocess

import cv2
import numpy as np

from processing.detection import (
    BlobRecord, CentroidTracker, contours_to_blobs, detect_contours,
)
from processing.rendering import TrailRenderer, render_frame


def detect_blobs_for_clip(
    clip_path: Path,
    detection_params: dict,
) -> list[list[BlobRecord]]:
    """Stream through clip, run detection on every frame, return per-frame blob lists."""
    cap = cv2.VideoCapture(str(clip_path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open {clip_path}")

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    diagonal = math.hypot(width, height)
    tracker = CentroidTracker(frame_diagonal=diagonal)

    per_frame: list[list[BlobRecord]] = []
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            contours = detect_contours(frame, **detection_params)
            blobs = contours_to_blobs(contours, frame_shape=frame.shape)
            blobs = tracker.update(blobs)
            per_frame.append(blobs)
    finally:
        cap.release()

    return per_frame


def render_clip(
    *,
    src: Path,
    dst: Path,
    per_frame_blobs: list[list[BlobRecord]],
    render_params: dict,
    progress_callback=None,
) -> Path:
    """Stream through src, draw layers per frame, encode to dst (no audio)."""
    cap = cv2.VideoCapture(str(src))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open {src}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    n_frames = len(per_frame_blobs)

    trail_decay = TrailRenderer.decay_from_length(
        render_params["trail"]["length_frames"]
    )
    trail = TrailRenderer(
        shape=(height, width, 3),
        decay=trail_decay,
        color=render_params["trail"]["color"],
        thickness=render_params["trail"]["thickness"],
    )

    # Use FFmpeg pipe for proper H.264 encoding
    import subprocess
    cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{width}x{height}",
        "-pix_fmt", "bgr24",
        "-r", str(fps),
        "-i", "-",  # Input from stdin
        "-vcodec", "libx264",
        "-crf", "23",  # For preview
        "-pix_fmt", "yuv420p",
        "-preset", "ultrafast",
        str(dst)
    ]
    
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    
    try:
        for i in range(n_frames):
            ok, frame = cap.read()
            if not ok:
                break
            rendered = render_frame(frame, per_frame_blobs[i], render_params, trail_renderer=trail)
            proc.stdin.write(rendered.tobytes())
            if progress_callback is not None:
                progress_callback(i + 1, n_frames)
    finally:
        cap.release()
        proc.stdin.close()
        proc.wait()

    return dst