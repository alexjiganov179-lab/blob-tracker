"""Streamlit parameter panel: preset bar + collapsible per-layer sections."""
from __future__ import annotations

import streamlit as st

from processing.presets import load_presets


def _hex_to_bgr(hex_str: str) -> tuple[int, int, int]:
    h = hex_str.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return (b, g, r)  # OpenCV is BGR


def _bgr_to_hex(bgr: tuple) -> str:
    b, g, r = bgr[0], bgr[1], bgr[2]
    return f"#{r:02x}{g:02x}{b:02x}"


def render_preset_bar() -> None:
    """Top-of-panel preset buttons. Clicking writes a preset into session_state."""
    presets = load_presets()
    cols = st.columns(len(presets))
    for col, (name, params) in zip(cols, presets.items()):
        if col.button(name, use_container_width=True):
            st.session_state["params"] = params
            st.rerun()


def render_param_panel() -> dict:
    """Render all sections, return current params dict."""
    if "params" not in st.session_state:
        st.session_state["params"] = load_presets()["Neon Debug"]
    p = st.session_state["params"]

    render_preset_bar()
    st.divider()

    # Detection (always on)
    with st.expander("🔍 Detection", expanded=True):
        d = p["detection"]
        d["crop_offset"] = st.slider("Crop offset (-1 left, +1 right)", -1.0, 1.0, float(d["crop_offset"]), 0.05)
        d["canny_low"] = st.slider("Canny low", 0, 255, int(d["canny_low"]))
        d["canny_high"] = st.slider("Canny high", 0, 255, int(d["canny_high"]))
        d["min_blob_size"] = st.number_input("Min blob size (px²)", 0, 1_000_000, int(d["min_blob_size"]), step=50)
        d["max_blob_size"] = st.number_input("Max blob size (px²)", 0, 10_000_000, int(d["max_blob_size"]), step=1000)
        bk = st.slider("Blur kernel (odd)", 1, 31, int(d["blur_kernel"]), step=2)
        d["blur_kernel"] = bk if bk % 2 == 1 else bk + 1

    # Contour
    with st.expander("✏️ Contour", expanded=True):
        c = p["contour"]
        c["enabled"] = st.toggle("Enabled", value=c["enabled"], key="contour_enabled")
        c["color"] = _hex_to_bgr(st.color_picker("Color", _bgr_to_hex(c["color"]), key="contour_color"))
        c["thickness"] = st.slider("Thickness", 1, 10, int(c["thickness"]), key="contour_thick")
        c["epsilon_ratio"] = st.slider("Smoothing (% of arcLength)", 0.0, 0.05, float(c["epsilon_ratio"]), 0.001, key="contour_eps")
        c["use_convex_hull"] = st.checkbox("Convex hull", value=c["use_convex_hull"], key="contour_hull")

    # Fill
    with st.expander("🎨 Fill"):
        f = p["fill"]
        f["enabled"] = st.toggle("Enabled", value=f["enabled"], key="fill_enabled")
        f["color"] = _hex_to_bgr(st.color_picker("Color", _bgr_to_hex(f["color"]), key="fill_color"))
        f["opacity"] = st.slider("Opacity", 0.0, 1.0, float(f["opacity"]), 0.05, key="fill_op")

    # Bounding box
    with st.expander("📦 Bounding box"):
        b = p["bbox"]
        b["enabled"] = st.toggle("Enabled", value=b["enabled"], key="bbox_enabled")
        b["color"] = _hex_to_bgr(st.color_picker("Color", _bgr_to_hex(b["color"]), key="bbox_color"))
        b["thickness"] = st.slider("Thickness", 1, 6, int(b["thickness"]), key="bbox_thick")

    # Trail
    with st.expander("🌀 Trail"):
        t = p["trail"]
        t["enabled"] = st.toggle("Enabled", value=t["enabled"], key="trail_enabled")
        t["length_frames"] = st.slider("Length (frames)", 5, 60, int(t["length_frames"]), key="trail_len")
        t["color"] = _hex_to_bgr(st.color_picker("Color", _bgr_to_hex(t["color"]), key="trail_color"))
        t["thickness"] = st.slider("Thickness", 1, 6, int(t["thickness"]), key="trail_thick")

    # Centroid
    with st.expander("⊙ Centroid"):
        ct = p["centroid"]
        ct["enabled"] = st.toggle("Enabled", value=ct["enabled"], key="cent_enabled")
        ct["color"] = _hex_to_bgr(st.color_picker("Color", _bgr_to_hex(ct["color"]), key="cent_color"))
        ct["radius"] = st.slider("Radius", 2, 20, int(ct["radius"]), key="cent_rad")

    # Labels
    with st.expander("🏷 Labels"):
        l = p["labels"]
        l["enabled"] = st.toggle("Enabled", value=l["enabled"], key="lbl_enabled")
        l["show_id"] = st.checkbox("Show ID", value=l["show_id"], key="lbl_id")
        l["show_area"] = st.checkbox("Show area", value=l["show_area"], key="lbl_area")
        l["show_coords"] = st.checkbox("Show coords", value=l["show_coords"], key="lbl_coords")
        l["font_size"] = st.slider("Font size", 8, 24, int(l["font_size"]), key="lbl_font")
        l["text_color"] = _hex_to_bgr(st.color_picker("Text color", _bgr_to_hex(l["text_color"]), key="lbl_text_color"))
        # bg color: hex picker + alpha slider
        bg_hex = st.color_picker("Bg color", _bgr_to_hex(l["bg_color"][:3]), key="lbl_bg_color")
        bg_alpha = st.slider("Bg alpha", 0, 255, int(l["bg_color"][3]), key="lbl_bg_alpha")
        bgr = _hex_to_bgr(bg_hex)
        l["bg_color"] = (bgr[0], bgr[1], bgr[2], bg_alpha)

    st.divider()
    if st.button("🔄 Reset to defaults"):
        st.session_state["params"] = load_presets()["Neon Debug"]
        st.rerun()

    return p