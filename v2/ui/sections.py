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


def render_detection_section(d: dict) -> None:
    """Detection expander: sensitivity buttons + fine-tune sliders."""
    with st.expander("🔍 Детекция", expanded=True):

        # Sensitivity buttons
        st.caption("Чувствительность")
        current = _sensitivity_level(d)
        cols = st.columns(3)
        for col, (level, label) in zip(cols, _SENSITIVITY_LABELS.items()):
            btn_type = "primary" if current == level else "secondary"
            if col.button(label, type=btn_type, use_container_width=True, key=f"sens_{level}"):
                d.update(SENSITIVITY_PRESETS[level])
                # Sync widget state so sliders update immediately on rerun
                st.session_state["det_canny_low"] = d["canny_low"]
                st.session_state["det_canny_high"] = d["canny_high"]
                st.session_state["det_blur"] = d["blur_kernel"]
                st.rerun()

        st.caption("Тонкая настройка")

        d["canny_low"] = st.slider(
            "Нижний порог контуров", 0, 255, int(d["canny_low"]), key="det_canny_low"
        )
        d["canny_high"] = st.slider(
            "Верхний порог контуров", 0, 255, int(d["canny_high"]), key="det_canny_high"
        )

        bk = st.slider("Размытие", 1, 31, int(d["blur_kernel"]), step=2, key="det_blur")
        d["blur_kernel"] = bk if bk % 2 == 1 else bk + 1

        d["min_blob_size"] = st.number_input(
            "Мин. размер объекта (px²)", 0, 1_000_000, int(d["min_blob_size"]), step=50, key="det_min"
        )
        d["max_blob_size"] = st.number_input(
            "Макс. размер объекта (px²)", 0, 10_000_000, int(d["max_blob_size"]), step=1000, key="det_max"
        )

        d["crop_offset"] = st.slider(
            "Кадрирование", -1.0, 1.0, float(d["crop_offset"]), 0.05, key="det_crop"
        )
        st.caption("← левее · правее →")
