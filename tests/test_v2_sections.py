"""Tests for v2/ui/sections.py pure logic functions."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from v2.ui.sections import _hex_to_bgr, _bgr_to_hex


def test_hex_to_bgr_converts_correctly():
    assert _hex_to_bgr("#ff0000") == (0, 0, 255)   # red → BGR
    assert _hex_to_bgr("#00ff00") == (0, 255, 0)   # green → BGR
    assert _hex_to_bgr("#0000ff") == (255, 0, 0)   # blue → BGR


def test_bgr_to_hex_converts_correctly():
    assert _bgr_to_hex((0, 0, 255)) == "#ff0000"
    assert _bgr_to_hex((0, 255, 0)) == "#00ff00"
    assert _bgr_to_hex((255, 0, 0)) == "#0000ff"


def test_roundtrip():
    original = "#1a2b3c"
    assert _bgr_to_hex(_hex_to_bgr(original)) == original


from v2.ui.sections import SENSITIVITY_PRESETS, _sensitivity_level
from processing.presets import load_presets


def test_sensitivity_level_detects_low():
    d = {"canny_low": 80, "canny_high": 200, "blur_kernel": 9, "min_blob_size": 300, "max_blob_size": 200000, "crop_offset": 0.0}
    assert _sensitivity_level(d) == "low"


def test_sensitivity_level_detects_mid():
    d = {"canny_low": 50, "canny_high": 150, "blur_kernel": 5, "min_blob_size": 300, "max_blob_size": 200000, "crop_offset": 0.0}
    assert _sensitivity_level(d) == "mid"


def test_sensitivity_level_detects_high():
    d = {"canny_low": 30, "canny_high": 80, "blur_kernel": 3, "min_blob_size": 300, "max_blob_size": 200000, "crop_offset": 0.0}
    assert _sensitivity_level(d) == "high"


def test_sensitivity_level_custom_when_no_match():
    d = {"canny_low": 99, "canny_high": 199, "blur_kernel": 7, "min_blob_size": 300, "max_blob_size": 200000, "crop_offset": 0.0}
    assert _sensitivity_level(d) == "custom"


def test_sensitivity_presets_have_required_keys():
    for level, preset in SENSITIVITY_PRESETS.items():
        assert "canny_low" in preset
        assert "canny_high" in preset
        assert "blur_kernel" in preset


from v2.ui.sections import RUSSIAN_PRESET_NAMES


def test_russian_preset_names_cover_all_presets():
    presets = load_presets()
    for original_name in presets:
        assert original_name in RUSSIAN_PRESET_NAMES, f"Missing Russian name for preset: {original_name}"


from v2.ui.sections import _active_layer_pills


def test_active_layer_pills_returns_enabled_only():
    params = {
        "contour": {"enabled": True},
        "fill": {"enabled": False},
        "bbox": {"enabled": True},
        "trail": {"enabled": False},
        "centroid": {"enabled": False},
        "labels": {"enabled": True},
    }
    pills = _active_layer_pills(params)
    assert "✏️ Контур" in pills
    assert "📦 Рамки" in pills
    assert "🏷 Подписи" in pills
    assert "🎨 Заливка" not in pills
    assert "🌀 Трейл" not in pills


def test_active_layer_pills_empty_when_all_disabled():
    params = {k: {"enabled": False} for k in ["contour", "fill", "bbox", "trail", "centroid", "labels"]}
    assert _active_layer_pills(params) == []
