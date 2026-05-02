# Contour VFX Overlay

Local Streamlit app that adds Canny-based contour overlays to videos in the
"everything looks better with blob tracking" aesthetic. Inspired by
artkit.cc/baby-track and whenistheweekend.com/vfx.html, but free and offline.

## Features

- Upload mp4 / mov / mkv → 9:16 auto-crop → looping preview
- Live preview at 540×960 (downscaled for speed)
- Layers: contour, fill, bounding box, trail, centroid, ID/area labels
- 5 presets: Neon Debug, Minimal White, Bounding Boxes, Blob Fill, Glitch
- Full-resolution streaming export with original audio preserved

## Requirements

- Python 3.11+
- FFmpeg installed and on PATH
- Windows / macOS / Linux

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
```

## Run

```bash
streamlit run app.py
```

## Tests

```bash
pytest
```

## Project layout

- `app.py` — Streamlit entrypoint
- `processing/` — pure-function pipeline (detect, render, preview, export)
- `ui/` — Streamlit components
- `presets.json` — preset definitions
- `tests/` — pytest suite (synthetic video fixtures, no binary blobs)

## Known limitations

This is a **contour VFX effect**, not a stable object tracker. ID numbers and
trails will flicker — that's expected and part of the look.