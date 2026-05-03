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
