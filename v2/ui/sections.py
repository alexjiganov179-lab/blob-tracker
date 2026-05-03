"""Streamlit parameter panel v2 — Russian UI, simplified for content creators."""
from __future__ import annotations

import streamlit as st
from processing.presets import load_presets


def _hex_to_bgr(hex_str: str) -> tuple[int, int, int]:
    h = hex_str.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return (b, g, r)


def _bgr_to_hex(bgr: tuple) -> str:
    b, g, r = bgr[0], bgr[1], bgr[2]
    return f"#{r:02x}{g:02x}{b:02x}"


SENSITIVITY_PRESETS: dict[str, dict] = {
    "low":  {"canny_low": 80,  "canny_high": 200, "blur_kernel": 9},
    "mid":  {"canny_low": 50,  "canny_high": 150, "blur_kernel": 5},
    "high": {"canny_low": 30,  "canny_high": 80,  "blur_kernel": 3},
}

_SENSITIVITY_LABELS = {
    "low":  "Мало объектов",
    "mid":  "Средне",
    "high": "Много объектов",
}

RUSSIAN_PRESET_NAMES: dict[str, str] = {
    "Neon Debug":     "Неон",
    "Minimal White":  "Минимал",
    "Bounding Boxes": "Рамки",
    "Blob Fill":      "Заливка",
    "Glitch":         "Глитч",
}


def _sensitivity_level(d: dict) -> str:
    """Return which sensitivity preset matches detection params, or 'custom'."""
    for level, preset in SENSITIVITY_PRESETS.items():
        if (d["canny_low"] == preset["canny_low"] and
                d["canny_high"] == preset["canny_high"] and
                d["blur_kernel"] == preset["blur_kernel"]):
            return level
    return "custom"


def render_preset_bar() -> None:
    """Row of preset buttons with Russian labels."""
    presets = load_presets()
    cols = st.columns(len(presets))
    for col, (original_name, params) in zip(cols, presets.items()):
        label = RUSSIAN_PRESET_NAMES.get(original_name, original_name)
        if col.button(label, use_container_width=True, key=f"preset_{original_name}"):
            st.session_state["params"] = params
            st.rerun()
