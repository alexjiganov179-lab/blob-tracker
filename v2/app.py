"""Contour VFX Overlay v2 — Russian UI entrypoint."""
from __future__ import annotations

import hashlib
import shutil
import sys
import tempfile
from pathlib import Path

# Allow imports of shared processing/ and v2/ui/ packages
sys.path.insert(0, str(Path(__file__).parent.parent))

import streamlit as st

from processing.preview import build_preview_clip
from processing.pipeline import detect_blobs_for_clip, render_clip
from processing.export import export_video
from processing.presets import load_presets
from v2.ui.sections import render_param_panel, render_active_layers_indicator


st.set_page_config(page_title="Contour VFX Overlay v2", layout="wide")


def _check_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        st.error(
            "FFmpeg не найден. Установи с https://ffmpeg.org/ и добавь в PATH, затем перезапусти."
        )
        st.stop()


_check_ffmpeg()

if "session_dir" not in st.session_state:
    st.session_state["session_dir"] = Path(tempfile.mkdtemp(prefix="blob_tracker_v2_"))
SESSION_DIR: Path = st.session_state["session_dir"]


def _file_hash(path: Path) -> str:
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


@st.cache_data(show_spinner="Строим превью…")
def _build_preview(source_hash: str, source_path: str, crop_offset: float) -> str:
    src = Path(source_path)
    dst = SESSION_DIR / f"preview_{source_hash[:8]}_{int(crop_offset*100)}.mp4"
    build_preview_clip(src=src, dst=dst, crop_offset=crop_offset)
    return str(dst)


@st.cache_data(show_spinner="Ищем объекты…")
def _detect(preview_path: str, detection_params: dict):
    return detect_blobs_for_clip(Path(preview_path), detection_params)


@st.cache_data(show_spinner="Рендерим превью…")
def _render(preview_path: str, _detection_params: dict, render_params: dict, blobs_key: str):
    blobs = _detect(preview_path, _detection_params)
    param_hash = hashlib.sha256(str(render_params).encode()).hexdigest()[:16]
    dst = SESSION_DIR / f"render_{blobs_key}_{param_hash}.mp4"
    render_clip(
        src=Path(preview_path),
        dst=dst,
        per_frame_blobs=blobs,
        render_params=render_params,
    )
    return str(dst)


st.title("Contour VFX Overlay")
st.caption("Добавляй VFX-оверлеи к видео для Reels.")

left, right = st.columns([1.5, 1])

with left:
    uploaded = st.file_uploader("Загрузи видео", type=["mp4", "mov", "mkv"])
    source_path: Path | None = None

    if uploaded is not None:
        ext = Path(uploaded.name).suffix.lower()
        if ext not in {".mp4", ".mov", ".mkv"}:
            st.error("Формат не поддерживается. Используй mp4, mov или mkv.")
            uploaded = None
        else:
            source_path = SESSION_DIR / uploaded.name
            if not source_path.exists() or source_path.stat().st_size != uploaded.size:
                source_path.write_bytes(uploaded.getbuffer())

            import cv2
            cap = cv2.VideoCapture(str(source_path))
            if not cap.isOpened():
                st.error("Не удалось открыть видео. Файл может быть повреждён.")
                source_path = None
            else:
                fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
                n = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
                duration = n / max(1, fps)
                cap.release()
                if duration > 120 and not st.checkbox(
                    f"Видео длиной {duration:.0f}с — обработка займёт время. Продолжить?"
                ):
                    source_path = None

    preview_placeholder = st.empty()
    layers_placeholder = st.empty()
    export_placeholder = st.empty()

with right:
    params = render_param_panel()

# Preview pipeline
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
    if preview_path is not None:
        st.video(str(preview_path), loop=True, autoplay=True, muted=True)
    else:
        st.info("Загрузи видео чтобы увидеть превью")

with layers_placeholder.container():
    render_active_layers_indicator(params)

with export_placeholder.container():
    if source_path is not None:
        if st.button("⬇ Экспортировать MP4 в полном качестве", type="primary", use_container_width=True):
            progress = st.progress(0.0, text="Экспортируем…")
            out = SESSION_DIR / f"export_{src_hash[:8]}.mp4"

            def cb(i, n):
                progress.progress(i / max(1, n), text=f"Кадр {i}/{n}")

            try:
                export_video(
                    src=source_path,
                    dst=out,
                    crop_offset=params["detection"]["crop_offset"],
                    detection_params=detection_params,
                    render_params={k: v for k, v in params.items() if k != "detection"},
                    progress_callback=cb,
                )
                progress.progress(1.0, text="Готово!")
                st.download_button(
                    "Скачать MP4",
                    data=out.read_bytes(),
                    file_name="output_v2.mp4",
                    mime="video/mp4",
                    use_container_width=True,
                )
            except Exception as e:
                st.error(f"Ошибка экспорта: {e}")