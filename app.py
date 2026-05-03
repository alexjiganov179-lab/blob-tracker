"""Contour VFX Overlay — Streamlit entrypoint."""
from __future__ import annotations

import hashlib
import shutil
import tempfile
from pathlib import Path

import streamlit as st

from processing.preview import build_preview_clip
from processing.pipeline import detect_blobs_for_clip, render_clip
from processing.export import export_video
from processing.presets import load_presets
from ui.sections import render_param_panel
from ui.player import render_preview


st.set_page_config(page_title="Contour VFX Overlay", layout="wide")


def _check_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        st.error(
            "FFmpeg not found in PATH. Install from https://ffmpeg.org/ "
            "and add the bin directory to PATH, then restart."
        )
        st.stop()


_check_ffmpeg()

# --- Session-scoped temp directory ----------------------------------------
if "session_dir" not in st.session_state:
    st.session_state["session_dir"] = Path(tempfile.mkdtemp(prefix="blob_tracker_"))
SESSION_DIR: Path = st.session_state["session_dir"]


# --- Cached helpers --------------------------------------------------------
def _file_hash(path: Path) -> str:
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


@st.cache_data(show_spinner="Building preview clip…")
def _build_preview(source_hash: str, source_path: str, crop_offset: float) -> str:
    src = Path(source_path)
    dst = SESSION_DIR / f"preview_{source_hash[:8]}_{int(crop_offset*100)}.mp4"
    build_preview_clip(src=src, dst=dst, crop_offset=crop_offset)
    return str(dst)


@st.cache_data(show_spinner="Detecting contours…")
def _detect(preview_path: str, detection_params: dict):
    return detect_blobs_for_clip(Path(preview_path), detection_params)


@st.cache_data(show_spinner="Rendering preview…")
def _render(preview_path: str, _detection_params: dict, render_params: dict, blobs_key: str):
    """`blobs_key` ties this cache entry to the detection result."""
    blobs = _detect(preview_path, _detection_params)
    # Create a deterministic filename based on the parameters
    import hashlib
    param_hash = hashlib.sha256(str(render_params).encode()).hexdigest()[:16]
    dst = SESSION_DIR / f"render_{blobs_key}_{param_hash}.mp4"
    render_clip(
        src=Path(preview_path),
        dst=dst,
        per_frame_blobs=blobs,
        render_params=render_params,
    )
    return str(dst)


# --- Layout ---------------------------------------------------------------
st.title("Contour VFX Overlay")
st.caption("Local Streamlit app for adding tracker-style overlays to videos.")

left, right = st.columns([1.5, 1])

with left:
    uploaded = st.file_uploader("Upload video", type=["mp4", "mov", "mkv"])
    source_path: Path | None = None

    if uploaded is not None:
        ext = Path(uploaded.name).suffix.lower()
        if ext not in {".mp4", ".mov", ".mkv"}:
            st.error("Failed to read video. Supported: mp4, mov, mkv.")
            uploaded = None
        else:
            source_path = SESSION_DIR / uploaded.name
            if not source_path.exists() or source_path.stat().st_size != uploaded.size:
                source_path.write_bytes(uploaded.getbuffer())

            # Probe duration via OpenCV
            import cv2
            cap = cv2.VideoCapture(str(source_path))
            if not cap.isOpened():
                st.error("Failed to read video. The file may be corrupt.")
                source_path = None
            else:
                fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
                n = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
                duration = n / max(1, fps)
                cap.release()
                if duration > 120 and not st.checkbox(
                    f"Video is {duration:.0f}s long — processing may be slow. Continue?"
                ):
                    source_path = None

    preview_placeholder = st.empty()
    export_placeholder = st.empty()

with right:
    params = render_param_panel()

# --- Preview pipeline ----------------------------------------------------
preview_path: Path | None = None
if source_path is not None:
    src_hash = _file_hash(source_path)
    detection_params = {
        "canny_low": params["detection"]["canny_low"],
        "canny_high": params["detection"]["canny_high"],
        "min_blob_size": params["detection"]["min_blob_size"],
        "max_blob_size": params["detection"]["max_blob_size"],
        "blur_kernel": params["detection"]["blur_kernel"],
    }

    preview_src = Path(_build_preview(
        source_hash=src_hash,
        source_path=str(source_path),
        crop_offset=params["detection"]["crop_offset"],
    ))

    blobs_key = hashlib.sha1(
        f"{preview_src.name}-{detection_params}".encode()
    ).hexdigest()[:12]

    rendered = Path(_render(
        preview_path=str(preview_src),
        _detection_params=detection_params,
        render_params={k: v for k, v in params.items() if k != "detection"},
        blobs_key=blobs_key,
    ))
    preview_path = rendered

with preview_placeholder.container():
    render_preview(preview_path)

# --- Export -----------------------------------------------------------
if source_path is not None:
    with export_placeholder.container():
        if st.button("⬇ Export Full-Res MP4", type="primary", use_container_width=True):
            progress = st.progress(0.0, text="Exporting…")
            out = SESSION_DIR / f"export_{src_hash[:8]}.mp4"

            def cb(i, n):
                progress.progress(i / max(1, n), text=f"Rendering frame {i}/{n}")

            try:
                export_video(
                    src=source_path,
                    dst=out,
                    crop_offset=params["detection"]["crop_offset"],
                    detection_params=detection_params,
                    render_params={k: v for k, v in params.items() if k != "detection"},
                    progress_callback=cb,
                )
                progress.progress(1.0, text="Done")
                st.download_button(
                    "Download MP4",
                    data=out.read_bytes(),
                    file_name="output.mp4",
                    mime="video/mp4",
                    use_container_width=True,
                )
            except Exception as e:
                st.error(f"Export failed: {e}")