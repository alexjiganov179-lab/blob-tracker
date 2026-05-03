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


def render_layer_sections(p: dict) -> None:
    """Five layer expanders with basic params only."""

    # Контур
    c = p["contour"]
    with st.expander("✏️ Контур", expanded=bool(c["enabled"])):
        c["enabled"] = st.toggle("Включить", value=c["enabled"], key="c_on")
        c["color"] = _hex_to_bgr(st.color_picker("Цвет", _bgr_to_hex(c["color"]), key="c_col"))
        c["thickness"] = st.slider("Толщина", 1, 10, int(c["thickness"]), key="c_thick")

    # Заливка
    f = p["fill"]
    with st.expander("🎨 Заливка", expanded=bool(f["enabled"])):
        f["enabled"] = st.toggle("Включить", value=f["enabled"], key="f_on")
        f["color"] = _hex_to_bgr(st.color_picker("Цвет", _bgr_to_hex(f["color"]), key="f_col"))
        f["opacity"] = st.slider("Прозрачность", 0.0, 1.0, float(f["opacity"]), 0.05, key="f_op")

    # Рамки
    b = p["bbox"]
    with st.expander("📦 Рамки", expanded=bool(b["enabled"])):
        b["enabled"] = st.toggle("Включить", value=b["enabled"], key="b_on")
        b["color"] = _hex_to_bgr(st.color_picker("Цвет", _bgr_to_hex(b["color"]), key="b_col"))
        b["thickness"] = st.slider("Толщина", 1, 6, int(b["thickness"]), key="b_thick")

    # Трейл
    t = p["trail"]
    with st.expander("🌀 Трейл", expanded=bool(t["enabled"])):
        t["enabled"] = st.toggle("Включить", value=t["enabled"], key="t_on")
        t["length_frames"] = st.slider("Длина трейла (кадры)", 5, 60, int(t["length_frames"]), key="t_len")
        t["color"] = _hex_to_bgr(st.color_picker("Цвет", _bgr_to_hex(t["color"]), key="t_col"))
        t["thickness"] = st.slider("Толщина", 1, 6, int(t["thickness"]), key="t_thick")

    # Подписи
    l = p["labels"]
    with st.expander("🏷 Подписи", expanded=bool(l["enabled"])):
        l["enabled"] = st.toggle("Включить", value=l["enabled"], key="l_on")
        l["show_id"] = st.checkbox("Показывать ID", value=l["show_id"], key="l_id")
        l["show_area"] = st.checkbox("Показывать площадь", value=l["show_area"], key="l_area")
        l["font_size"] = st.slider("Размер текста", 8, 24, int(l["font_size"]), key="l_font")
