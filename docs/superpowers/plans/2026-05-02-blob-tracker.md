# Contour VFX Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Streamlit app that adds Canny-based contour VFX overlays to videos, with a downscaled live preview and full-resolution streaming export with audio preserved.

**Architecture:** Streaming OpenCV pipeline split into a low-res cached preview path and a full-res on-demand export path. Pure-function `processing/` module decoupled from a Streamlit `ui/` layer. FFmpeg handles crop, encode, and audio mux as subprocess calls.

**Tech Stack:** Python 3.11+, Streamlit, OpenCV (`opencv-python`), NumPy, FFmpeg (system binary), `ffmpeg-python` wrapper, pytest.

---

## File Map

**Created:**
- `app.py` — Streamlit entrypoint
- `requirements.txt`, `.gitignore`, `README.md`
- `presets.json` — Default preset definitions
- `processing/__init__.py`
- `processing/detection.py` — Canny + contour finding + centroid tracker
- `processing/rendering.py` — Layer drawing functions (contour, fill, bbox, labels, centroid, trail)
- `processing/preview.py` — Build downscaled preview clip via ffmpeg
- `processing/pipeline.py` — Streaming preview detect + render
- `processing/export.py` — Full-res streaming export with audio mux
- `ui/__init__.py`
- `ui/sections.py` — Parameter sections + preset bar
- `ui/player.py` — Video preview component
- `.streamlit/config.toml`
- `tests/__init__.py`
- `tests/conftest.py` — Synthetic-video fixture generator
- `tests/test_detection.py`
- `tests/test_rendering.py`
- `tests/test_pipeline.py`
- `tests/test_export.py`

**Test strategy:** Synthetic videos generated programmatically via OpenCV in `tests/conftest.py` — no binary fixtures in git. Tests run against generated MP4s in pytest tmp dirs.

---

## Task 1: Project Scaffolding

**Files:**
- Create: `requirements.txt`, `.gitignore`, `pytest.ini`, `processing/__init__.py`, `ui/__init__.py`, `tests/__init__.py`, `.streamlit/config.toml`

- [ ] **Step 1: Create requirements.txt**

```
streamlit>=1.30
opencv-python>=4.8
numpy>=1.24
ffmpeg-python>=0.2
pytest>=7.4
```

- [ ] **Step 2: Update .gitignore (already has `.superpowers/`)**

Append:
```
__pycache__/
*.pyc
.pytest_cache/
*.egg-info/
.venv/
venv/
temp_*.mp4
*.mov
output.mp4
.streamlit/secrets.toml
```

- [ ] **Step 3: Create empty package init files**

```bash
touch processing/__init__.py ui/__init__.py tests/__init__.py
```

- [ ] **Step 4: Create pytest.ini**

```ini
[pytest]
testpaths = tests
python_files = test_*.py
addopts = -v --tb=short
```

- [ ] **Step 5: Create .streamlit/config.toml**

```toml
[theme]
base = "dark"
primaryColor = "#0a84ff"

[server]
maxUploadSize = 500
```

- [ ] **Step 6: Set up venv and install**

```bash
python -m venv .venv
.venv\Scripts\activate    # Windows
pip install -r requirements.txt
```

Expected: install succeeds, `streamlit --version` works.

- [ ] **Step 7: Commit**

```bash
git add requirements.txt .gitignore pytest.ini processing/__init__.py ui/__init__.py tests/__init__.py .streamlit/config.toml
git commit -m "chore: scaffold project structure and dependencies"
```

---

## Task 2: Synthetic Video Test Fixture

**Files:**
- Create: `tests/conftest.py`

- [ ] **Step 1: Write fixture that generates a tiny test video**

`tests/conftest.py`:
```python
import cv2
import numpy as np
import pytest
from pathlib import Path


@pytest.fixture
def synthetic_video(tmp_path):
    """Generate a 2-second 480x360 video with a moving white square on black bg."""
    path = tmp_path / "synthetic.mp4"
    fps = 30
    width, height = 480, 360
    duration_sec = 2
    n_frames = fps * duration_sec

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(path), fourcc, fps, (width, height))

    for i in range(n_frames):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        # white square moves left to right
        x = int((i / n_frames) * (width - 80))
        cv2.rectangle(frame, (x, 140), (x + 80, 220), (255, 255, 255), -1)
        writer.write(frame)

    writer.release()
    assert path.exists() and path.stat().st_size > 0
    return path


@pytest.fixture
def synthetic_video_with_audio(tmp_path, synthetic_video):
    """Same as synthetic_video but with a silent audio track muxed in via ffmpeg."""
    import subprocess
    out = tmp_path / "synthetic_audio.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(synthetic_video),
            "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-c:v", "copy", "-c:a", "aac", "-shortest",
            str(out),
        ],
        check=True, capture_output=True,
    )
    return out
```

- [ ] **Step 2: Verify fixtures produce readable video**

Create temp `tests/test_smoke.py`:
```python
import cv2

def test_synthetic_video_readable(synthetic_video):
    cap = cv2.VideoCapture(str(synthetic_video))
    assert cap.isOpened()
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    assert n == 60
    cap.release()


def test_synthetic_audio_video_readable(synthetic_video_with_audio):
    cap = cv2.VideoCapture(str(synthetic_video_with_audio))
    assert cap.isOpened()
    cap.release()
```

Run: `pytest tests/test_smoke.py -v`
Expected: both pass.

- [ ] **Step 3: Delete smoke test (was just verification)**

```bash
rm tests/test_smoke.py
```

- [ ] **Step 4: Commit**

```bash
git add tests/conftest.py
git commit -m "test: add synthetic video fixtures"
```

---

## Task 3: Detection — Canny + Contour Finding + Size Filter

**Files:**
- Create: `processing/detection.py`, `tests/test_detection.py`

- [ ] **Step 1: Write the failing test**

`tests/test_detection.py`:
```python
import numpy as np
import cv2
from processing.detection import detect_contours


def test_detect_contours_finds_white_square_on_black():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    cv2.rectangle(frame, (60, 60), (140, 140), (255, 255, 255), -1)

    contours = detect_contours(
        frame,
        canny_low=50, canny_high=150,
        min_blob_size=100, max_blob_size=10_000,
        blur_kernel=3,
    )

    assert len(contours) == 1
    area = cv2.contourArea(contours[0])
    assert 5000 < area < 7000  # ~80x80 = 6400


def test_detect_contours_filters_small_blobs():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    cv2.rectangle(frame, (10, 10), (15, 15), (255, 255, 255), -1)  # 5x5 = 25
    cv2.rectangle(frame, (60, 60), (140, 140), (255, 255, 255), -1)  # 80x80

    contours = detect_contours(
        frame,
        canny_low=50, canny_high=150,
        min_blob_size=100, max_blob_size=10_000,
        blur_kernel=3,
    )
    assert len(contours) == 1


def test_detect_contours_filters_large_blobs():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    cv2.rectangle(frame, (10, 10), (190, 190), (255, 255, 255), -1)  # huge

    contours = detect_contours(
        frame,
        canny_low=50, canny_high=150,
        min_blob_size=100, max_blob_size=1000,
        blur_kernel=3,
    )
    assert len(contours) == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_detection.py -v`
Expected: ImportError / ModuleNotFoundError on `processing.detection`.

- [ ] **Step 3: Write minimal implementation**

`processing/detection.py`:
```python
"""Contour detection pipeline: blur → Canny → findContours → size filter."""
from __future__ import annotations

import cv2
import numpy as np


def detect_contours(
    frame: np.ndarray,
    *,
    canny_low: int,
    canny_high: int,
    min_blob_size: float,
    max_blob_size: float,
    blur_kernel: int,
) -> list[np.ndarray]:
    """Detect contours in a single BGR frame.

    Returns a list of contours (each a numpy array of [x, y] points)
    whose area is within [min_blob_size, max_blob_size].
    """
    if blur_kernel < 1 or blur_kernel % 2 == 0:
        raise ValueError(f"blur_kernel must be odd and >= 1, got {blur_kernel}")

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (blur_kernel, blur_kernel), 0)
    edges = cv2.Canny(blurred, canny_low, canny_high)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    return [c for c in contours if min_blob_size <= cv2.contourArea(c) <= max_blob_size]
```

- [ ] **Step 4: Run test**

Run: `pytest tests/test_detection.py -v`
Expected: all 3 pass.

- [ ] **Step 5: Commit**

```bash
git add processing/detection.py tests/test_detection.py
git commit -m "feat(detection): add Canny-based contour detection with size filter"
```

---

## Task 4: Detection — Blob Records and Centroid Tracker

**Files:**
- Modify: `processing/detection.py`, `tests/test_detection.py`

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_detection.py`:
```python
from processing.detection import BlobRecord, CentroidTracker, contours_to_blobs


def test_contours_to_blobs_computes_attributes():
    frame_shape = (200, 200, 3)
    contour = np.array([[[60, 60]], [[140, 60]], [[140, 140]], [[60, 140]]], dtype=np.int32)

    blobs = contours_to_blobs([contour], frame_shape=frame_shape)

    assert len(blobs) == 1
    b = blobs[0]
    assert isinstance(b, BlobRecord)
    assert b.area == 6400
    assert b.centroid == (100, 100)
    assert b.bbox == (60, 60, 80, 80)


def test_centroid_tracker_keeps_id_for_close_blob():
    tracker = CentroidTracker(frame_diagonal=300.0)  # max_distance = 15
    b1 = BlobRecord(centroid=(100, 100), area=50, bbox=(95, 95, 10, 10), contour=None, id=None)
    b2 = BlobRecord(centroid=(105, 105), area=50, bbox=(100, 100, 10, 10), contour=None, id=None)

    [tracked1] = tracker.update([b1])
    [tracked2] = tracker.update([b2])

    assert tracked1.id == tracked2.id == 0


def test_centroid_tracker_assigns_new_id_for_far_blob():
    tracker = CentroidTracker(frame_diagonal=300.0)  # max_distance = 15
    b1 = BlobRecord(centroid=(100, 100), area=50, bbox=(95, 95, 10, 10), contour=None, id=None)
    b2 = BlobRecord(centroid=(200, 200), area=50, bbox=(195, 195, 10, 10), contour=None, id=None)

    [tracked1] = tracker.update([b1])
    [tracked2] = tracker.update([b2])

    assert tracked1.id == 0
    assert tracked2.id == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_detection.py -v`
Expected: ImportError on `BlobRecord`, `CentroidTracker`, `contours_to_blobs`.

- [ ] **Step 3: Implement BlobRecord and contours_to_blobs**

Append to `processing/detection.py`:
```python
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class BlobRecord:
    centroid: tuple[int, int]
    area: float
    bbox: tuple[int, int, int, int]  # x, y, w, h
    contour: Optional[np.ndarray]
    id: Optional[int] = None


def contours_to_blobs(
    contours: list[np.ndarray], *, frame_shape: tuple[int, int, int]
) -> list[BlobRecord]:
    """Compute centroid, area, and bbox for each contour."""
    blobs: list[BlobRecord] = []
    for c in contours:
        m = cv2.moments(c)
        if m["m00"] == 0:
            x, y, w, h = cv2.boundingRect(c)
            cx, cy = x + w // 2, y + h // 2
        else:
            cx = int(m["m10"] / m["m00"])
            cy = int(m["m01"] / m["m00"])
        x, y, w, h = cv2.boundingRect(c)
        area = float(cv2.contourArea(c))
        blobs.append(BlobRecord(centroid=(cx, cy), area=area, bbox=(x, y, w, h), contour=c))
    return blobs


class CentroidTracker:
    """Simple nearest-centroid ID tracker.

    For each frame, assign each blob the ID of the nearest blob from the
    previous frame within `max_distance`. Otherwise assign a fresh ID.
    """

    def __init__(self, frame_diagonal: float, distance_ratio: float = 0.05):
        self.max_distance = frame_diagonal * distance_ratio
        self._next_id = 0
        self._prev: list[BlobRecord] = []

    def update(self, blobs: list[BlobRecord]) -> list[BlobRecord]:
        for b in blobs:
            best_id, best_dist = None, self.max_distance
            for p in self._prev:
                dx = b.centroid[0] - p.centroid[0]
                dy = b.centroid[1] - p.centroid[1]
                d = (dx * dx + dy * dy) ** 0.5
                if d < best_dist:
                    best_dist = d
                    best_id = p.id
            if best_id is None:
                b.id = self._next_id
                self._next_id += 1
            else:
                b.id = best_id
        self._prev = blobs
        return blobs
```

- [ ] **Step 4: Run test**

Run: `pytest tests/test_detection.py -v`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add processing/detection.py tests/test_detection.py
git commit -m "feat(detection): add BlobRecord, centroid tracker, contour-to-blob conversion"
```

---

## Task 5: Rendering — Contour Layer

**Files:**
- Create: `processing/rendering.py`, `tests/test_rendering.py`

- [ ] **Step 1: Write the failing test**

`tests/test_rendering.py`:
```python
import numpy as np
import cv2
from processing.detection import BlobRecord
from processing.rendering import draw_contour_layer


def _make_blob():
    contour = np.array(
        [[[60, 60]], [[140, 60]], [[140, 140]], [[60, 140]]], dtype=np.int32
    )
    return BlobRecord(
        centroid=(100, 100), area=6400, bbox=(60, 60, 80, 80), contour=contour, id=0
    )


def test_draw_contour_modifies_pixels_at_edge():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    blob = _make_blob()

    out = draw_contour_layer(
        frame, [blob],
        color=(0, 255, 0), thickness=2,
        epsilon_ratio=0.0, use_convex_hull=False,
    )

    assert out[60, 100, 1] > 0  # green channel set on top edge
    assert out[100, 100, 1] == 0  # interior untouched


def test_draw_contour_disabled_returns_unchanged():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    out = draw_contour_layer(
        frame, [],
        color=(0, 255, 0), thickness=2,
        epsilon_ratio=0.0, use_convex_hull=False,
    )
    assert np.array_equal(out, frame)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_rendering.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement**

`processing/rendering.py`:
```python
"""Visual layer drawing functions. Each `draw_*_layer` returns a new frame."""
from __future__ import annotations

import cv2
import numpy as np

from processing.detection import BlobRecord


def draw_contour_layer(
    frame: np.ndarray,
    blobs: list[BlobRecord],
    *,
    color: tuple[int, int, int],
    thickness: int,
    epsilon_ratio: float,
    use_convex_hull: bool,
) -> np.ndarray:
    """Draw contour outlines onto a copy of `frame`."""
    out = frame.copy()
    for b in blobs:
        if b.contour is None:
            continue
        cnt = b.contour
        if use_convex_hull:
            cnt = cv2.convexHull(cnt)
        if epsilon_ratio > 0:
            eps = epsilon_ratio * cv2.arcLength(cnt, True)
            cnt = cv2.approxPolyDP(cnt, eps, True)
        cv2.drawContours(out, [cnt], -1, color, thickness)
    return out
```

- [ ] **Step 4: Run test**

Run: `pytest tests/test_rendering.py -v`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add processing/rendering.py tests/test_rendering.py
git commit -m "feat(rendering): add contour layer with smoothing and convex hull options"
```

---

## Task 6: Rendering — Fill Layer

**Files:**
- Modify: `processing/rendering.py`, `tests/test_rendering.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_rendering.py`:
```python
from processing.rendering import draw_fill_layer


def test_draw_fill_blends_color_into_blob_interior():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    blob = _make_blob()

    out = draw_fill_layer(frame, [blob], color=(0, 0, 255), opacity=0.5)

    # Interior pixel (100,100) should have ~half-strength red
    r = out[100, 100, 2]
    assert 100 < r < 160
    # Outside (10,10) untouched
    assert out[10, 10, 2] == 0
```

- [ ] **Step 2: Run test (fails — not implemented)**

Run: `pytest tests/test_rendering.py::test_draw_fill_blends_color_into_blob_interior -v`
Expected: ImportError.

- [ ] **Step 3: Implement**

Append to `processing/rendering.py`:
```python
def draw_fill_layer(
    frame: np.ndarray,
    blobs: list[BlobRecord],
    *,
    color: tuple[int, int, int],
    opacity: float,
) -> np.ndarray:
    """Alpha-blend filled polygons onto a copy of `frame`."""
    if opacity <= 0 or not blobs:
        return frame.copy()
    overlay = frame.copy()
    for b in blobs:
        if b.contour is None:
            continue
        cv2.drawContours(overlay, [b.contour], -1, color, thickness=cv2.FILLED)
    return cv2.addWeighted(overlay, opacity, frame, 1.0 - opacity, 0)
```

- [ ] **Step 4: Run test**

Run: `pytest tests/test_rendering.py -v`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add processing/rendering.py tests/test_rendering.py
git commit -m "feat(rendering): add fill layer with alpha blend"
```

---

## Task 7: Rendering — Bounding Box Layer

**Files:**
- Modify: `processing/rendering.py`, `tests/test_rendering.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_rendering.py`:
```python
from processing.rendering import draw_bbox_layer


def test_draw_bbox_marks_all_four_edges():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    blob = _make_blob()

    out = draw_bbox_layer(frame, [blob], color=(255, 0, 0), thickness=2)

    # bbox is (60, 60, 80, 80)
    assert out[60, 100, 0] > 0   # top edge has blue
    assert out[140, 100, 0] > 0  # bottom edge
    assert out[100, 60, 0] > 0   # left
    assert out[100, 140, 0] > 0  # right
    assert out[100, 100, 0] == 0  # interior untouched
```

- [ ] **Step 2: Run test (fails)**

Run: `pytest tests/test_rendering.py::test_draw_bbox_marks_all_four_edges -v`

- [ ] **Step 3: Implement**

Append to `processing/rendering.py`:
```python
def draw_bbox_layer(
    frame: np.ndarray,
    blobs: list[BlobRecord],
    *,
    color: tuple[int, int, int],
    thickness: int,
) -> np.ndarray:
    out = frame.copy()
    for b in blobs:
        x, y, w, h = b.bbox
        cv2.rectangle(out, (x, y), (x + w, y + h), color, thickness)
    return out
```

- [ ] **Step 4: Run test**

Run: `pytest tests/test_rendering.py -v`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add processing/rendering.py tests/test_rendering.py
git commit -m "feat(rendering): add bounding box layer"
```

---

## Task 8: Rendering — Centroid Layer

**Files:**
- Modify: `processing/rendering.py`, `tests/test_rendering.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_rendering.py`:
```python
from processing.rendering import draw_centroid_layer


def test_draw_centroid_marks_centroid_pixel():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    blob = _make_blob()

    out = draw_centroid_layer(frame, [blob], color=(0, 255, 255), radius=5)

    # centroid at (100,100); cv2 uses BGR, so yellow = (0,255,255)
    assert out[100, 100, 1] > 0  # green
    assert out[100, 100, 2] > 0  # red
    assert out[100, 100, 0] == 0  # blue zero
```

- [ ] **Step 2: Run test (fails)**

- [ ] **Step 3: Implement**

Append to `processing/rendering.py`:
```python
def draw_centroid_layer(
    frame: np.ndarray,
    blobs: list[BlobRecord],
    *,
    color: tuple[int, int, int],
    radius: int,
) -> np.ndarray:
    out = frame.copy()
    for b in blobs:
        cv2.circle(out, b.centroid, radius, color, thickness=-1)
    return out
```

- [ ] **Step 4: Run test**

Run: `pytest tests/test_rendering.py -v`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add processing/rendering.py tests/test_rendering.py
git commit -m "feat(rendering): add centroid layer"
```

---

## Task 9: Rendering — Labels Layer

**Files:**
- Modify: `processing/rendering.py`, `tests/test_rendering.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_rendering.py`:
```python
from processing.rendering import draw_labels_layer


def test_draw_labels_writes_text_when_show_id_enabled():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    blob = _make_blob()

    out = draw_labels_layer(
        frame, [blob],
        show_id=True, show_area=False, show_coords=False,
        font_size=12, text_color=(255, 255, 255), bg_color=(0, 0, 0, 0),
    )

    # Some pixels above the bbox should be non-zero (text rendered)
    region = out[40:60, 60:140, :]
    assert region.sum() > 0


def test_draw_labels_disabled_returns_unchanged():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    blob = _make_blob()

    out = draw_labels_layer(
        frame, [blob],
        show_id=False, show_area=False, show_coords=False,
        font_size=12, text_color=(255, 255, 255), bg_color=(0, 0, 0, 0),
    )
    assert np.array_equal(out, frame)
```

- [ ] **Step 2: Run test (fails)**

- [ ] **Step 3: Implement**

Append to `processing/rendering.py`:
```python
def draw_labels_layer(
    frame: np.ndarray,
    blobs: list[BlobRecord],
    *,
    show_id: bool,
    show_area: bool,
    show_coords: bool,
    font_size: int,
    text_color: tuple[int, int, int],
    bg_color: tuple[int, int, int, int],  # BGRA
) -> np.ndarray:
    if not (show_id or show_area or show_coords):
        return frame.copy()

    out = frame.copy()
    font = cv2.FONT_HERSHEY_SIMPLEX
    scale = font_size / 24.0  # ~24pt = scale 1.0

    for b in blobs:
        parts = []
        if show_id and b.id is not None:
            parts.append(f"#{b.id}")
        if show_area:
            parts.append(f"a:{int(b.area)}")
        if show_coords:
            parts.append(f"({b.centroid[0]},{b.centroid[1]})")
        if not parts:
            continue
        text = " ".join(parts)

        x, y = b.bbox[0], max(b.bbox[1] - 6, font_size)
        (tw, th), _ = cv2.getTextSize(text, font, scale, 1)

        if bg_color[3] > 0:
            overlay = out.copy()
            cv2.rectangle(
                overlay,
                (x - 2, y - th - 4),
                (x + tw + 2, y + 2),
                bg_color[:3],
                thickness=cv2.FILLED,
            )
            alpha = bg_color[3] / 255.0
            out = cv2.addWeighted(overlay, alpha, out, 1 - alpha, 0)

        cv2.putText(out, text, (x, y), font, scale, text_color, 1, cv2.LINE_AA)

    return out
```

- [ ] **Step 4: Run test**

Run: `pytest tests/test_rendering.py -v`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add processing/rendering.py tests/test_rendering.py
git commit -m "feat(rendering): add labels layer (ID, area, coords) with optional bg"
```

---

## Task 10: Rendering — Trail Layer with Decaying Overlay

**Files:**
- Modify: `processing/rendering.py`, `tests/test_rendering.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_rendering.py`:
```python
from processing.rendering import TrailRenderer


def test_trail_renderer_decays_over_time():
    renderer = TrailRenderer(
        shape=(200, 200, 3),
        decay=0.5,  # heavy decay for visible test
        color=(0, 0, 255),
        thickness=2,
    )

    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    b1 = BlobRecord(centroid=(50, 100), area=10, bbox=(45, 95, 10, 10), contour=None, id=0)
    b2 = BlobRecord(centroid=(60, 100), area=10, bbox=(55, 95, 10, 10), contour=None, id=0)

    out1 = renderer.draw(frame, [b1])
    val_just_drawn = renderer.overlay[100, 55, 2]  # red on the segment

    # Now do many more steps without drawing through that pixel — it should decay
    for _ in range(10):
        renderer.draw(frame, [b2])
    val_after_decay = renderer.overlay[100, 55, 2]
    assert val_after_decay < val_just_drawn / 4
```

- [ ] **Step 2: Run test (fails)**

- [ ] **Step 3: Implement**

Append to `processing/rendering.py`:
```python
class TrailRenderer:
    """Stateful per-frame trail renderer using a decaying overlay buffer.

    Maintains a persistent BGR overlay; each frame:
      1. multiply overlay by decay factor (old marks fade)
      2. for each blob with a known previous centroid, draw a line segment
         from previous to current centroid onto the overlay
      3. add the overlay onto the frame (saturating at 255)
    """

    def __init__(
        self,
        shape: tuple[int, int, int],
        *,
        decay: float,
        color: tuple[int, int, int],
        thickness: int,
    ):
        self.overlay = np.zeros(shape, dtype=np.float32)
        self.decay = float(decay)
        self.color = color
        self.thickness = thickness
        self._prev_centroids: dict[int, tuple[int, int]] = {}

    def draw(self, frame: np.ndarray, blobs: list[BlobRecord]) -> np.ndarray:
        # decay
        self.overlay *= self.decay

        # add new line segments
        new_centroids: dict[int, tuple[int, int]] = {}
        for b in blobs:
            if b.id is None:
                continue
            prev = self._prev_centroids.get(b.id)
            if prev is not None:
                cv2.line(self.overlay, prev, b.centroid, self.color, self.thickness)
            new_centroids[b.id] = b.centroid
        self._prev_centroids = new_centroids

        # composite (additive, clipped)
        out = frame.astype(np.float32) + self.overlay
        return np.clip(out, 0, 255).astype(np.uint8)

    @staticmethod
    def decay_from_length(length_frames: int) -> float:
        """Convert UI 'trail length' (frames) into a per-frame decay factor."""
        return float(np.exp(-1.0 / max(1, length_frames)))
```

- [ ] **Step 4: Run test**

Run: `pytest tests/test_rendering.py -v`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add processing/rendering.py tests/test_rendering.py
git commit -m "feat(rendering): add trail renderer with decaying overlay"
```

---

## Task 11: Rendering — Composite render_frame

**Files:**
- Modify: `processing/rendering.py`, `tests/test_rendering.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_rendering.py`:
```python
from processing.rendering import render_frame


def test_render_frame_applies_only_enabled_layers():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    blob = _make_blob()
    trail = TrailRenderer(shape=frame.shape, decay=0.9, color=(255, 0, 0), thickness=2)

    params = {
        "contour": {"enabled": True, "color": (0, 255, 0), "thickness": 2,
                    "epsilon_ratio": 0.0, "use_convex_hull": False},
        "fill": {"enabled": False},
        "bbox": {"enabled": False},
        "trail": {"enabled": False},
        "centroid": {"enabled": False},
        "labels": {"enabled": False},
    }
    out = render_frame(frame, [blob], params, trail_renderer=trail)

    # Green from contour present
    assert out[60, 100, 1] > 0
    # Red from any other layer absent
    assert out[60, 100, 2] == 0
```

- [ ] **Step 2: Run test (fails)**

- [ ] **Step 3: Implement**

Append to `processing/rendering.py`:
```python
def render_frame(
    frame: np.ndarray,
    blobs: list[BlobRecord],
    params: dict,
    *,
    trail_renderer: TrailRenderer,
) -> np.ndarray:
    """Apply enabled layers in canonical order: fill → contour → bbox → trail → centroid → labels."""
    out = frame

    if params["fill"].get("enabled"):
        p = params["fill"]
        out = draw_fill_layer(out, blobs, color=p["color"], opacity=p["opacity"])

    if params["contour"].get("enabled"):
        p = params["contour"]
        out = draw_contour_layer(
            out, blobs,
            color=p["color"], thickness=p["thickness"],
            epsilon_ratio=p["epsilon_ratio"], use_convex_hull=p["use_convex_hull"],
        )

    if params["bbox"].get("enabled"):
        p = params["bbox"]
        out = draw_bbox_layer(out, blobs, color=p["color"], thickness=p["thickness"])

    if params["trail"].get("enabled"):
        out = trail_renderer.draw(out, blobs)
    else:
        # still advance the renderer state so prev_centroids stay current
        trail_renderer._prev_centroids = {b.id: b.centroid for b in blobs if b.id is not None}

    if params["centroid"].get("enabled"):
        p = params["centroid"]
        out = draw_centroid_layer(out, blobs, color=p["color"], radius=p["radius"])

    if params["labels"].get("enabled"):
        p = params["labels"]
        out = draw_labels_layer(
            out, blobs,
            show_id=p["show_id"], show_area=p["show_area"], show_coords=p["show_coords"],
            font_size=p["font_size"], text_color=p["text_color"], bg_color=p["bg_color"],
        )

    return out
```

- [ ] **Step 4: Run test**

Run: `pytest tests/test_rendering.py -v`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add processing/rendering.py tests/test_rendering.py
git commit -m "feat(rendering): add render_frame composite with canonical layer order"
```

---

## Task 12: Preview Clip Builder

**Files:**
- Create: `processing/preview.py`, `tests/test_preview.py`

- [ ] **Step 1: Write the failing test**

`tests/test_preview.py`:
```python
import cv2
from processing.preview import build_preview_clip


def test_build_preview_clip_outputs_540x960(synthetic_video, tmp_path):
    out_path = tmp_path / "preview.mp4"

    build_preview_clip(
        src=synthetic_video,
        dst=out_path,
        crop_offset=0.0,
        target_width=540,
        target_height=960,
    )

    assert out_path.exists()
    cap = cv2.VideoCapture(str(out_path))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()
    assert (w, h) == (540, 960)
```

- [ ] **Step 2: Run test (fails)**

Run: `pytest tests/test_preview.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement**

`processing/preview.py`:
```python
"""Build the downscaled preview source clip used by the interactive editor."""
from __future__ import annotations

import subprocess
from pathlib import Path


def build_preview_clip(
    *,
    src: Path,
    dst: Path,
    crop_offset: float,
    target_width: int = 540,
    target_height: int = 960,
) -> Path:
    """Crop source to 9:16 with horizontal offset, scale to target dims, no audio.

    crop_offset:  -1.0 = leftmost, 0.0 = center, +1.0 = rightmost. Clamped.
    """
    crop_offset = max(-1.0, min(1.0, crop_offset))

    # crop=ih*9/16:ih:(iw - ih*9/16)*((offset+1)/2):0
    crop_filter = (
        f"crop=ih*9/16:ih:(iw - ih*9/16)*(({crop_offset} + 1)/2):0,"
        f"scale={target_width}:{target_height}:flags=lanczos"
    )

    cmd = [
        "ffmpeg", "-y", "-i", str(src),
        "-vf", crop_filter,
        "-an",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
        "-pix_fmt", "yuv420p",
        str(dst),
    ]
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.decode(errors='replace')}")

    return dst
```

- [ ] **Step 4: Run test**

Run: `pytest tests/test_preview.py -v`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add processing/preview.py tests/test_preview.py
git commit -m "feat(preview): build downscaled 9:16 preview clip via ffmpeg"
```

---

## Task 13: Pipeline — Streaming Detect

**Files:**
- Create: `processing/pipeline.py`, `tests/test_pipeline.py`

- [ ] **Step 1: Write the failing test**

`tests/test_pipeline.py`:
```python
from processing.pipeline import detect_blobs_for_clip


def test_detect_blobs_for_clip_returns_per_frame_lists(synthetic_video):
    detection_params = {
        "canny_low": 50, "canny_high": 150,
        "min_blob_size": 100, "max_blob_size": 100_000,
        "blur_kernel": 3,
    }

    per_frame = detect_blobs_for_clip(synthetic_video, detection_params)

    assert len(per_frame) == 60  # 2 sec * 30 fps
    # The moving square should appear in most frames
    nonempty = sum(1 for blobs in per_frame if len(blobs) > 0)
    assert nonempty > 30
    # IDs are assigned (single moving object should keep same id much of the time)
    ids_seen = {b.id for blobs in per_frame for b in blobs}
    assert len(ids_seen) >= 1
```

- [ ] **Step 2: Run test (fails)**

- [ ] **Step 3: Implement**

`processing/pipeline.py`:
```python
"""Streaming detect+render pipelines for preview and export paths."""
from __future__ import annotations

import math
from pathlib import Path
import subprocess

import cv2
import numpy as np

from processing.detection import (
    BlobRecord, CentroidTracker, contours_to_blobs, detect_contours,
)
from processing.rendering import TrailRenderer, render_frame


def detect_blobs_for_clip(
    clip_path: Path,
    detection_params: dict,
) -> list[list[BlobRecord]]:
    """Stream through clip, run detection on every frame, return per-frame blob lists."""
    cap = cv2.VideoCapture(str(clip_path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open {clip_path}")

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    diagonal = math.hypot(width, height)
    tracker = CentroidTracker(frame_diagonal=diagonal)

    per_frame: list[list[BlobRecord]] = []
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            contours = detect_contours(frame, **detection_params)
            blobs = contours_to_blobs(contours, frame_shape=frame.shape)
            blobs = tracker.update(blobs)
            per_frame.append(blobs)
    finally:
        cap.release()

    return per_frame
```

- [ ] **Step 4: Run test**

Run: `pytest tests/test_pipeline.py -v`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add processing/pipeline.py tests/test_pipeline.py
git commit -m "feat(pipeline): streaming blob detection for full clip"
```

---

## Task 14: Pipeline — Streaming Render Preview

**Files:**
- Modify: `processing/pipeline.py`, `tests/test_pipeline.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_pipeline.py`:
```python
from processing.pipeline import render_clip


def _default_render_params():
    return {
        "contour": {"enabled": True, "color": (0, 255, 0), "thickness": 2,
                    "epsilon_ratio": 0.0, "use_convex_hull": False},
        "fill": {"enabled": False, "color": (0, 0, 255), "opacity": 0.5},
        "bbox": {"enabled": False, "color": (255, 0, 0), "thickness": 2},
        "trail": {"enabled": False, "length_frames": 30, "color": (0, 255, 255), "thickness": 2},
        "centroid": {"enabled": False, "color": (0, 255, 255), "radius": 5},
        "labels": {"enabled": False, "show_id": True, "show_area": False, "show_coords": False,
                   "font_size": 12, "text_color": (255, 255, 255), "bg_color": (0, 0, 0, 0)},
    }


def test_render_clip_produces_valid_mp4(synthetic_video, tmp_path):
    detection_params = {
        "canny_low": 50, "canny_high": 150,
        "min_blob_size": 100, "max_blob_size": 100_000,
        "blur_kernel": 3,
    }
    blobs = detect_blobs_for_clip(synthetic_video, detection_params)
    out_path = tmp_path / "rendered.mp4"

    render_clip(
        src=synthetic_video,
        dst=out_path,
        per_frame_blobs=blobs,
        render_params=_default_render_params(),
    )

    assert out_path.exists() and out_path.stat().st_size > 0
    cap = cv2.VideoCapture(str(out_path))
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()
    assert n == 60
```

- [ ] **Step 2: Run test (fails)**

- [ ] **Step 3: Implement**

Append to `processing/pipeline.py`:
```python
def render_clip(
    *,
    src: Path,
    dst: Path,
    per_frame_blobs: list[list[BlobRecord]],
    render_params: dict,
    progress_callback=None,
) -> Path:
    """Stream through src, draw layers per frame, encode to dst (no audio)."""
    cap = cv2.VideoCapture(str(src))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open {src}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    n_frames = len(per_frame_blobs)

    trail_decay = TrailRenderer.decay_from_length(
        render_params["trail"]["length_frames"]
    )
    trail = TrailRenderer(
        shape=(height, width, 3),
        decay=trail_decay,
        color=render_params["trail"]["color"],
        thickness=render_params["trail"]["thickness"],
    )

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(dst), fourcc, fps, (width, height))

    try:
        for i in range(n_frames):
            ok, frame = cap.read()
            if not ok:
                break
            rendered = render_frame(frame, per_frame_blobs[i], render_params, trail_renderer=trail)
            writer.write(rendered)
            if progress_callback is not None:
                progress_callback(i + 1, n_frames)
    finally:
        cap.release()
        writer.release()

    return dst
```

- [ ] **Step 4: Run test**

Run: `pytest tests/test_pipeline.py -v`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add processing/pipeline.py tests/test_pipeline.py
git commit -m "feat(pipeline): streaming render of full clip with all enabled layers"
```

---

## Task 15: Export — Audio Mux with Stream-Copy Fallback

**Files:**
- Create: `processing/export.py`, `tests/test_export.py`

- [ ] **Step 1: Write the failing test**

`tests/test_export.py`:
```python
import subprocess
from processing.export import mux_audio


def _has_audio(path):
    res = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0",
         "-show_entries", "stream=codec_type", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True,
    )
    return "audio" in res.stdout


def test_mux_audio_preserves_audio_from_source(synthetic_video_with_audio, synthetic_video, tmp_path):
    out = tmp_path / "out.mp4"

    mux_audio(
        video_only=synthetic_video,        # silent
        audio_source=synthetic_video_with_audio,  # has audio
        dst=out,
    )

    assert out.exists()
    assert _has_audio(out)


def test_mux_audio_handles_silent_source(synthetic_video, tmp_path):
    out = tmp_path / "out.mp4"

    mux_audio(
        video_only=synthetic_video,
        audio_source=synthetic_video,  # also silent
        dst=out,
    )

    assert out.exists()
    assert not _has_audio(out)
```

- [ ] **Step 2: Run test (fails)**

- [ ] **Step 3: Implement**

`processing/export.py`:
```python
"""Final-export pipeline: full-res streaming render + audio mux."""
from __future__ import annotations

import subprocess
from pathlib import Path


def mux_audio(*, video_only: Path, audio_source: Path, dst: Path) -> Path:
    """Combine the video stream from `video_only` with the audio stream from `audio_source`.

    Try stream-copy first; fall back to AAC re-encode if the audio codec is incompatible.
    If `audio_source` has no audio stream, output silently with just the video.
    """
    base = [
        "ffmpeg", "-y",
        "-i", str(video_only),
        "-i", str(audio_source),
        "-map", "0:v:0",
        "-map", "1:a:0?",   # optional → no error if absent
        "-c:v", "copy",
        "-shortest",
    ]

    # First attempt: stream-copy audio
    cmd = base + ["-c:a", "copy", str(dst)]
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode == 0:
        return dst

    # Fallback: re-encode audio to AAC
    cmd = base + ["-c:a", "aac", "-b:a", "192k", str(dst)]
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg mux failed: {result.stderr.decode(errors='replace')}")
    return dst
```

- [ ] **Step 4: Run test**

Run: `pytest tests/test_export.py -v`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add processing/export.py tests/test_export.py
git commit -m "feat(export): audio mux with stream-copy and AAC fallback"
```

---

## Task 16: Export — Full-Res Crop+Render Pipeline

**Files:**
- Modify: `processing/export.py`, `tests/test_export.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_export.py`:
```python
import cv2
from processing.export import export_video
from tests.test_pipeline import _default_render_params


def test_export_video_produces_9by16_with_audio(synthetic_video_with_audio, tmp_path):
    detection_params = {
        "canny_low": 50, "canny_high": 150,
        "min_blob_size": 100, "max_blob_size": 100_000,
        "blur_kernel": 3,
    }
    out = tmp_path / "final.mp4"

    export_video(
        src=synthetic_video_with_audio,
        dst=out,
        crop_offset=0.0,
        detection_params=detection_params,
        render_params=_default_render_params(),
    )

    assert out.exists()
    cap = cv2.VideoCapture(str(out))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()
    # Source is 480x360 → 9:16 crop = 202x360
    assert h == 360
    assert abs(w - int(360 * 9 / 16)) <= 2
    assert _has_audio(out)
```

- [ ] **Step 2: Run test (fails)**

- [ ] **Step 3: Implement**

Append to `processing/export.py`:
```python
import tempfile

from processing.preview import build_preview_clip
from processing.pipeline import detect_blobs_for_clip, render_clip


def export_video(
    *,
    src: Path,
    dst: Path,
    crop_offset: float,
    detection_params: dict,
    render_params: dict,
    progress_callback=None,
) -> Path:
    """Full-resolution streaming export with audio preserved.

    Step 1: ffmpeg crops source to 9:16 at full resolution → cropped_silent.mp4
    Step 2: detect blobs across all frames (streaming)
    Step 3: render layers and encode → rendered_silent.mp4
    Step 4: mux original audio → dst
    """
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        cropped = td_path / "cropped.mp4"
        rendered = td_path / "rendered.mp4"

        # Reuse build_preview_clip with no scaling — pass through dims by reading source first.
        import cv2
        cap = cv2.VideoCapture(str(src))
        src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        cap.release()

        # 9:16 crop at full source height
        target_w = int(src_h * 9 / 16)
        # Even-number requirement for H.264
        if target_w % 2 != 0:
            target_w -= 1
        target_h = src_h if src_h % 2 == 0 else src_h - 1

        build_preview_clip(
            src=src, dst=cropped,
            crop_offset=crop_offset,
            target_width=target_w, target_height=target_h,
        )

        per_frame = detect_blobs_for_clip(cropped, detection_params)

        render_clip(
            src=cropped, dst=rendered,
            per_frame_blobs=per_frame,
            render_params=render_params,
            progress_callback=progress_callback,
        )

        mux_audio(video_only=rendered, audio_source=src, dst=dst)

    return dst
```

- [ ] **Step 4: Run test**

Run: `pytest tests/test_export.py -v`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add processing/export.py tests/test_export.py
git commit -m "feat(export): full-res streaming export pipeline with audio preservation"
```

---

## Task 17: Presets

**Files:**
- Create: `presets.json`, `processing/presets.py`, `tests/test_presets.py`

- [ ] **Step 1: Write the failing test**

`tests/test_presets.py`:
```python
from processing.presets import load_presets, default_params


def test_load_presets_returns_named_dict():
    presets = load_presets()
    assert "Neon Debug" in presets
    assert "Minimal White" in presets
    # Each preset is a full params dict
    p = presets["Neon Debug"]
    assert "contour" in p
    assert "trail" in p


def test_default_params_has_all_sections():
    p = default_params()
    for section in ["detection", "contour", "fill", "bbox", "trail", "centroid", "labels"]:
        assert section in p
```

- [ ] **Step 2: Run test (fails)**

- [ ] **Step 3: Define presets.json**

`presets.json`:
```json
{
  "Neon Debug": {
    "detection": {"crop_offset": 0.0, "canny_low": 50, "canny_high": 150,
                  "min_blob_size": 300, "max_blob_size": 200000, "blur_kernel": 5},
    "contour": {"enabled": true, "color": [0, 255, 255], "thickness": 2,
                "epsilon_ratio": 0.005, "use_convex_hull": false},
    "fill": {"enabled": false, "color": [0, 0, 255], "opacity": 0.3},
    "bbox": {"enabled": true, "color": [255, 0, 255], "thickness": 1},
    "trail": {"enabled": false, "length_frames": 30, "color": [0, 255, 255], "thickness": 2},
    "centroid": {"enabled": false, "color": [0, 255, 255], "radius": 4},
    "labels": {"enabled": true, "show_id": true, "show_area": true, "show_coords": false,
               "font_size": 12, "text_color": [255, 255, 255], "bg_color": [0, 0, 0, 180]}
  },
  "Minimal White": {
    "detection": {"crop_offset": 0.0, "canny_low": 80, "canny_high": 200,
                  "min_blob_size": 500, "max_blob_size": 200000, "blur_kernel": 5},
    "contour": {"enabled": true, "color": [255, 255, 255], "thickness": 1,
                "epsilon_ratio": 0.01, "use_convex_hull": false},
    "fill": {"enabled": false, "color": [255, 255, 255], "opacity": 0.2},
    "bbox": {"enabled": false, "color": [255, 255, 255], "thickness": 1},
    "trail": {"enabled": false, "length_frames": 20, "color": [255, 255, 255], "thickness": 1},
    "centroid": {"enabled": false, "color": [255, 255, 255], "radius": 3},
    "labels": {"enabled": false, "show_id": false, "show_area": false, "show_coords": false,
               "font_size": 10, "text_color": [255, 255, 255], "bg_color": [0, 0, 0, 0]}
  },
  "Bounding Boxes": {
    "detection": {"crop_offset": 0.0, "canny_low": 50, "canny_high": 150,
                  "min_blob_size": 800, "max_blob_size": 200000, "blur_kernel": 5},
    "contour": {"enabled": false, "color": [0, 255, 0], "thickness": 1,
                "epsilon_ratio": 0.0, "use_convex_hull": false},
    "fill": {"enabled": false, "color": [0, 0, 255], "opacity": 0.3},
    "bbox": {"enabled": true, "color": [0, 220, 255], "thickness": 2},
    "trail": {"enabled": false, "length_frames": 30, "color": [0, 220, 255], "thickness": 2},
    "centroid": {"enabled": false, "color": [0, 220, 255], "radius": 4},
    "labels": {"enabled": true, "show_id": true, "show_area": false, "show_coords": false,
               "font_size": 14, "text_color": [0, 0, 0], "bg_color": [0, 220, 255, 230]}
  },
  "Blob Fill": {
    "detection": {"crop_offset": 0.0, "canny_low": 50, "canny_high": 150,
                  "min_blob_size": 500, "max_blob_size": 200000, "blur_kernel": 7},
    "contour": {"enabled": true, "color": [255, 0, 200], "thickness": 1,
                "epsilon_ratio": 0.01, "use_convex_hull": true},
    "fill": {"enabled": true, "color": [255, 0, 200], "opacity": 0.35},
    "bbox": {"enabled": false, "color": [255, 0, 200], "thickness": 1},
    "trail": {"enabled": false, "length_frames": 30, "color": [255, 0, 200], "thickness": 2},
    "centroid": {"enabled": false, "color": [255, 255, 255], "radius": 3},
    "labels": {"enabled": false, "show_id": false, "show_area": false, "show_coords": false,
               "font_size": 10, "text_color": [255, 255, 255], "bg_color": [0, 0, 0, 0]}
  },
  "Glitch": {
    "detection": {"crop_offset": 0.0, "canny_low": 30, "canny_high": 100,
                  "min_blob_size": 200, "max_blob_size": 200000, "blur_kernel": 3},
    "contour": {"enabled": true, "color": [0, 255, 0], "thickness": 1,
                "epsilon_ratio": 0.0, "use_convex_hull": false},
    "fill": {"enabled": false, "color": [255, 0, 255], "opacity": 0.2},
    "bbox": {"enabled": false, "color": [255, 0, 0], "thickness": 1},
    "trail": {"enabled": true, "length_frames": 50, "color": [0, 255, 200], "thickness": 2},
    "centroid": {"enabled": true, "color": [255, 0, 0], "radius": 3},
    "labels": {"enabled": false, "show_id": false, "show_area": false, "show_coords": false,
               "font_size": 10, "text_color": [255, 255, 255], "bg_color": [0, 0, 0, 0]}
  }
}
```

- [ ] **Step 4: Implement loader**

`processing/presets.py`:
```python
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
```

- [ ] **Step 5: Run test**

Run: `pytest tests/test_presets.py -v`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add presets.json processing/presets.py tests/test_presets.py
git commit -m "feat(presets): define 5 default presets with loader"
```

---

## Task 18: UI — Parameter Sections

**Files:**
- Create: `ui/sections.py`

This task is UI-only and not unit-tested (verified manually with the running app in Task 20).

- [ ] **Step 1: Implement parameter sections**

`ui/sections.py`:
```python
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
    if st.button("🔄 Reset to Neon Debug"):
        st.session_state["params"] = load_presets()["Neon Debug"]
        st.rerun()

    return p
```

- [ ] **Step 2: Commit**

```bash
git add ui/sections.py
git commit -m "feat(ui): parameter panel with preset bar and collapsible sections"
```

---

## Task 19: UI — Video Player Component

**Files:**
- Create: `ui/player.py`

- [ ] **Step 1: Implement looping video player**

`ui/player.py`:
```python
"""Looping video preview component."""
from __future__ import annotations

from pathlib import Path
import streamlit as st


def render_preview(video_path: Path | None) -> None:
    if video_path is None or not video_path.exists():
        st.info("Upload a video to begin.")
        return
    st.video(str(video_path), loop=True, autoplay=True, muted=True)
```

- [ ] **Step 2: Commit**

```bash
git add ui/player.py
git commit -m "feat(ui): looping video preview component"
```

---

## Task 20: App — Wire It All Together

**Files:**
- Create: `app.py`

- [ ] **Step 1: Implement the Streamlit entrypoint**

`app.py`:
```python
"""Contour VFX Overlay — Streamlit entrypoint."""
from __future__ import annotations

import hashlib
import shutil
import tempfile
from pathlib import Path

import streamlit as st

from processing.preview import build_preview_clip
from processing.pipeline import detect_blobs_for_clip, render_clip
from processing.export import export_video
from ui.sections import render_param_panel
from ui.player import render_preview


st.set_page_config(page_title="Contour VFX Overlay", layout="wide")

# --- Session-scoped temp directory ----------------------------------------
if "session_dir" not in st.session_state:
    st.session_state["session_dir"] = Path(tempfile.mkdtemp(prefix="blob_tracker_"))
SESSION_DIR: Path = st.session_state["session_dir"]


# --- Cached helpers --------------------------------------------------------
def _file_hash(path: Path) -> str:
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


@st.cache_data(show_spinner="Building preview clip…")
def _build_preview(source_hash: str, source_path: str, crop_offset: float) -> str:
    src = Path(source_path)
    dst = SESSION_DIR / f"preview_{source_hash[:8]}_{int(crop_offset*100)}.mp4"
    build_preview_clip(src=src, dst=dst, crop_offset=crop_offset)
    return str(dst)


@st.cache_data(show_spinner="Detecting contours…")
def _detect(preview_path: str, detection_params: dict):
    return detect_blobs_for_clip(Path(preview_path), detection_params)


@st.cache_data(show_spinner="Rendering preview…")
def _render(preview_path: str, _detection_params: dict, render_params: dict, blobs_key: str):
    """`blobs_key` ties this cache entry to the detection result."""
    blobs = _detect(preview_path, _detection_params)
    dst = SESSION_DIR / f"render_{blobs_key}_{abs(hash(str(render_params)))}.mp4"
    render_clip(
        src=Path(preview_path),
        dst=dst,
        per_frame_blobs=blobs,
        render_params=render_params,
    )
    return str(dst)


# --- Layout ---------------------------------------------------------------
st.title("Contour VFX Overlay")
st.caption("Local Streamlit app for adding tracker-style overlays to videos.")

left, right = st.columns([1.5, 1])

with left:
    uploaded = st.file_uploader("Upload video", type=["mp4", "mov", "mkv"])
    source_path: Path | None = None

    if uploaded is not None:
        source_path = SESSION_DIR / uploaded.name
        if not source_path.exists() or source_path.stat().st_size != uploaded.size:
            source_path.write_bytes(uploaded.getbuffer())

    preview_placeholder = st.empty()
    export_placeholder = st.empty()

with right:
    params = render_param_panel()

# --- Preview pipeline ----------------------------------------------------
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
    render_preview(preview_path)

# --- Export -----------------------------------------------------------
if source_path is not None:
    with export_placeholder.container():
        if st.button("⬇ Export Full-Res MP4", type="primary", use_container_width=True):
            progress = st.progress(0.0, text="Exporting…")
            out = SESSION_DIR / f"export_{src_hash[:8]}.mp4"

            def cb(i, n):
                progress.progress(i / max(1, n), text=f"Rendering frame {i}/{n}")

            try:
                export_video(
                    src=source_path,
                    dst=out,
                    crop_offset=params["detection"]["crop_offset"],
                    detection_params=detection_params,
                    render_params={k: v for k, v in params.items() if k != "detection"},
                    progress_callback=cb,
                )
                progress.progress(1.0, text="Done")
                st.download_button(
                    "Download MP4",
                    data=out.read_bytes(),
                    file_name="output.mp4",
                    mime="video/mp4",
                    use_container_width=True,
                )
            except Exception as e:
                st.error(f"Export failed: {e}")
```

- [ ] **Step 2: Run the app and smoke-test manually**

```bash
streamlit run app.py
```

Expected:
- App opens in browser
- Upload a small mp4 → preview appears within ~10 sec
- Toggle Contour off/on → preview re-renders
- Click presets → all parameters jump
- Click Export → progress bar fills, download button appears

- [ ] **Step 3: Commit**

```bash
git add app.py
git commit -m "feat(app): wire UI to processing pipeline with cached preview path"
```

---

## Task 21: Error Handling

**Files:**
- Modify: `app.py`

- [ ] **Step 1: Add input validation and friendly error messages**

In `app.py`, replace the section starting at `if uploaded is not None:` inside the `with left:` block with:

```python
    if uploaded is not None:
        ext = Path(uploaded.name).suffix.lower()
        if ext not in {".mp4", ".mov", ".mkv"}:
            st.error("Failed to read video. Supported: mp4, mov, mkv.")
            uploaded = None
        else:
            source_path = SESSION_DIR / uploaded.name
            if not source_path.exists() or source_path.stat().st_size != uploaded.size:
                source_path.write_bytes(uploaded.getbuffer())

            # Probe duration via OpenCV
            import cv2
            cap = cv2.VideoCapture(str(source_path))
            if not cap.isOpened():
                st.error("Failed to read video. The file may be corrupt.")
                source_path = None
            else:
                fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
                n = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
                duration = n / max(1, fps)
                cap.release()
                if duration > 120 and not st.checkbox(
                    f"Video is {duration:.0f}s long — processing may be slow. Continue?"
                ):
                    source_path = None
```

- [ ] **Step 2: Add ffmpeg-presence check at startup**

Add near the top of `app.py`, after imports:

```python
def _check_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        st.error(
            "FFmpeg not found in PATH. Install from https://ffmpeg.org/ "
            "and add the bin directory to PATH, then restart."
        )
        st.stop()


_check_ffmpeg()
```

- [ ] **Step 3: Smoke test**

Run app, upload a `.txt` file → expect error message.
Upload normal mp4 → works.

- [ ] **Step 4: Commit**

```bash
git add app.py
git commit -m "feat(app): error handling for bad files, missing ffmpeg, long videos"
```

---

## Task 22: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

`README.md`:
```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup, usage, and limitations"
```

---

## Task 23: Final Verification

- [ ] **Step 1: Run all tests**

```bash
pytest
```

Expected: all tests pass.

- [ ] **Step 2: End-to-end smoke run**

```bash
streamlit run app.py
```

Manual checklist:
- [ ] Upload a real 10-30 sec video
- [ ] Preview appears within ~15 sec
- [ ] Click each of the 5 presets — all parameters update visibly
- [ ] Toggle each layer on/off — preview reflects changes
- [ ] Move crop offset slider — preview re-renders with new crop
- [ ] Click Export → progress bar fills → download button works
- [ ] Open downloaded MP4 in a player → audio plays, video is 9:16

- [ ] **Step 3: Final commit if any tweaks were needed**

```bash
git status
# if anything changed:
git add -A
git commit -m "chore: tweaks from final smoke test"
```

---

## Implementation Notes

- **Order matters:** detection → rendering primitives → composite → pipeline → export → UI → app. Each layer depends only on the ones above.
- **Tests are written first** for everything in `processing/`. UI is verified manually because Streamlit doesn't lend itself to automated UI tests.
- **Frequent commits:** every task ends with a commit. Don't batch.
- **Synthetic fixtures:** test videos are generated programmatically via `tests/conftest.py` — no binary fixtures in git.
- **Cache invalidation:** the layered `@st.cache_data` design (preview → detect → render) is what makes parameter tweaking feel responsive. Don't bypass it.
- **Streaming everywhere:** never read all frames into a list / array at once. Always iterate with `cv2.VideoCapture` and write through `cv2.VideoWriter`.
