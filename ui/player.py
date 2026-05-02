"""Looping video preview component."""
from __future__ import annotations

from pathlib import Path
import streamlit as st


def render_preview(video_path: Path | None) -> None:
    if video_path is None or not video_path.exists():
        st.info("Upload a video to begin.")
        return
    st.video(str(video_path), loop=True, autoplay=True, muted=True)