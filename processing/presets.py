"""Preset loading and default-parameter helpers."""
from __future__ import annotations

import json
from pathlib import Path
from copy import deepcopy

_PRESETS_PATH = Path(__file__).parent.parent / "presets.json"


def _coerce_colors(params: dict) -> dict:
    """JSON has lists, OpenCV needs tuples for colors."""
    p = deepcopy(params)
    for section_name, section in p.items():
        if not isinstance(section, dict):
            continue
        for k, v in section.items():
            if isinstance(v, list) and 3 <= len(v) <= 4 and all(isinstance(x, (int, float)) for x in v):
                section[k] = tuple(v)
    return p


def load_presets() -> dict[str, dict]:
    raw = json.loads(_PRESETS_PATH.read_text(encoding="utf-8"))
    return {name: _coerce_colors(params) for name, params in raw.items()}


def default_params() -> dict:
    return load_presets()["Neon Debug"]