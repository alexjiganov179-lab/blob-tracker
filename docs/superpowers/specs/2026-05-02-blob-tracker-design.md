# Blob Tracker — Streamlit App for Reels VFX

**Status:** Design approved, ready for implementation plan
**Date:** 2026-05-02

## Purpose

Local Streamlit application for adding "blob tracking" visual overlays to videos, with the goal of producing Instagram Reels in the "everything looks better with blob tracking on it" aesthetic. Inspired by paid web tools like artkit.cc/baby-track and whenistheweekend.com/vfx.html, but free and runs locally.

The user uploads a video file, configures the visual tracking style through a parameter panel with live preview, and exports the result as an MP4 with the original audio preserved.

## Non-Goals

- Webcam / live capture (file-only input)
- Skeleton / pose tracking (MediaPipe-style) — this is contour-based blob tracking only
- Multi-user / cloud deployment — single-user local app
- Plugin / preset marketplace
- Mobile UI

## Scope: Tracking Style

- **Aesthetic:** contour and silhouette overlays (cyan/neon outlines, semi-transparent fills, bounding boxes, ID labels) — the "computer vision debug output" look
- **Detection method:** edge detection (Canny) + contour finding, filtered by blob size. Tracks any object with sufficient edge contrast, not just movement. No background subtraction in v1.

## User Flow

1. User launches the app via `streamlit run app.py`
2. User drags an MP4/MOV/MKV file into the upload area
3. App auto-crops the video to 9:16 vertical (center crop) and runs initial detection (~10 sec)
4. A looping video preview appears, showing the result with default parameters
5. User adjusts parameters in the right-side panel; preview re-renders within 1–2 sec on changes
6. User clicks "Export MP4" → final video with audio is rendered (~10–20 sec) and offered as a download

## Architecture

### Stack

- Python 3.11+
- Streamlit (UI)
- OpenCV (`opencv-python`) — frame processing, edge detection, contour finding, drawing
- NumPy — frames as arrays
- FFmpeg (system binary, already installed) — video decode, 9:16 crop, final encode with audio passthrough
- `ffmpeg-python` wrapper for cleaner subprocess calls

### File Structure

```
blob-tracker/
├── app.py                  # Streamlit entrypoint, wires UI ↔ pipeline
├── requirements.txt
├── README.md
├── processing/             # Pure logic, no Streamlit imports
│   ├── __init__.py
│   ├── detection.py        # Edge detection, contour finding, ID tracking
│   ├── rendering.py        # Layer drawing (contour/fill/box/labels/centroid/trail)
│   ├── pipeline.py         # frame → detect → render → output frame
│   └── export.py           # ffmpeg encoding with audio passthrough
├── ui/                     # Streamlit components only
│   ├── __init__.py
│   ├── sections.py         # Collapsible parameter sections
│   └── preview.py          # Video preview component
├── .streamlit/
│   └── config.toml         # Theme, layout
└── tests/
    ├── fixtures/           # Short test videos
    └── test_processing.py  # Unit tests for processing/
```

### Separation of Concerns

- `processing/` is pure functions on numpy arrays and config dicts. No Streamlit imports. Unit-testable. Re-usable from a future CLI or other UI.
- `ui/` only contains Streamlit widget code. Reads / writes `st.session_state`. Does not call OpenCV directly.
- `app.py` glues them together: reads parameter values from session_state, calls the pipeline, displays results.

## Processing Pipeline

### On Video Upload

```
upload mp4
  → ffprobe metadata (fps, frame count, dims, audio stream presence)
  → ffmpeg auto-crop to 9:16 center (writes temp_cropped.mp4)
  → extract all frames into numpy array [N, H, W, 3]   (cached by file hash)
  → store original audio extracted to temp_audio.aac for later muxing
```

### On Detection Parameter Change

```
frames + detection_params
  → for each frame:
      grayscale → Gaussian blur → Canny edges → findContours
      → filter contours by min_size and max_size
  → derive per-blob attributes: centroid, bbox, area
  → run simple centroid tracker to assign persistent IDs across frames
  → result: List[List[BlobRecord]]  one list per frame
  (cached by file_hash + detection_params)
```

### On Render Parameter Change

```
frames + per-frame blobs + render_params
  → for each frame, draw enabled layers in order:
      1. fill (alpha-blend filled polygons)
      2. contour (drawContours, optional convex_hull / approxPolyDP)
      3. bounding box (rectangle)
      4. centroid (filled circle)
      5. trail (polyline through centroid history per ID, fading alpha)
      6. labels (putText for ID / area / coords)
  → encode rendered frames to a temp MP4 (no audio, H.264, fast preset)
  → return Path to temp MP4
  (cached by file_hash + detection_params + render_params)
  → st.video(path, loop=True, autoplay=True)
```

### Caching Strategy

Three-tier `@st.cache_data` keyed progressively:

1. `extract_frames(file_hash)` — invalidates only on new file
2. `detect_contours(file_hash, detection_params)` — invalidates on new file or detection-param change
3. `render_preview_video(file_hash, detection_params, render_params)` — invalidates on any change

A change to a render-only parameter (color, thickness, toggle) triggers only step 3.

### Performance Targets (Ryzen 5 1600X, 16GB RAM, 1080p 15s clip)

- Initial upload + detection: ≤ 13 seconds
- Render parameter change: 1–2 seconds
- Detection parameter change: 3–5 seconds
- Final export with audio: 10–20 seconds

## ID Tracking

A simple centroid tracker (~50 lines in `detection.py`):

- For each new frame, compute centroids of all detected blobs
- For each centroid, find the nearest centroid in the previous frame within `max_distance` pixels
- If found → carry over the ID
- If not found → assign a new ID
- Maintain a per-ID history of last `trail_length` centroids for the trail feature

Configurable in code (not exposed in UI v1): `max_distance = 80` px, `trail_length = 30` frames.

## UI Structure

### Layout

Two-column layout:

- **Left (1.5fr):** upload area, looping video preview (9:16), playback controls, "Export MP4" button
- **Right (1fr):** scrollable parameter panel with collapsible sections

### Parameter Sections

Each section after Detection has a master toggle. When off, that layer is skipped at render time.

| Section | Always-on? | Parameters |
|---|---|---|
| **Detection** | yes (foundation) | method (edge/threshold), Canny lower threshold, Canny upper threshold, min_blob_size, max_blob_size, blur_amount |
| **Contour** | toggle | color (picker), thickness (1–10), smoothing (approxPolyDP epsilon 0–0.05), use_convex_hull (bool) |
| **Fill** | toggle | color (picker), opacity (0–1) |
| **Bounding box** | toggle | color (picker), thickness (1–6) |
| **Labels** | toggle | show_id, show_area, show_coords, font_size (8–24), text_color, bg_color (with alpha) |
| **Centroid** | toggle | color, radius (2–20) |
| **Trail** | toggle | length_frames (5–60), color, thickness, fade (bool) |

### State Management

All parameter values stored in `st.session_state` under a single dict key `params`. Each widget reads/writes its corresponding key. The pipeline takes `params` as input.

A "Reset to defaults" button at the bottom of the panel clears `st.session_state["params"]` and reruns.

(Save/load preset to JSON is a nice-to-have but out of scope for v1.)

## Export

```
user clicks Export
  → st.progress bar appears
  → render all frames using current params (re-uses cache if available)
  → ffmpeg encodes frames into rendered.mp4 (H.264, CRF 18, yuv420p)
  → second ffmpeg pass mux:
      ffmpeg -i rendered.mp4 -i temp_cropped.mp4 \
             -map 0:v -map 1:a? -c:v copy -c:a aac \
             output.mp4
    (the `?` makes the audio map optional — works for silent inputs)
  → st.download_button("Download", "output.mp4")
```

Progress bar updates per frame during the rendering step.

## Error Handling

| Condition | Behavior |
|---|---|
| Non-video file uploaded | `st.error("Не удалось прочитать видео. Поддерживаются mp4, mov, mkv.")` |
| Video has no audio stream | Export proceeds without audio, info banner shown |
| FFmpeg not found in PATH | `st.error` with link to install instructions |
| Video longer than 120 seconds | Warning banner with confirm-to-proceed checkbox |
| Detection produces 0 blobs on a frame | Frame rendered with no overlays (silent, expected behavior) |
| Out of memory during frame extraction | `st.error("Видео слишком большое для оперативной памяти. Попробуй короче или меньше разрешением.")` |

## Testing

- **Unit tests** in `tests/test_processing.py` for pure functions in `processing/`:
  - `detect_contours` filters out blobs below `min_size` and above `max_size`
  - `render_frame` correctly skips layers when their toggle is off
  - Centroid tracker assigns the same ID to a blob that moves a small distance, and a new ID to one that teleports
- **Test fixtures:** 2 short videos (~2 seconds, 480p) committed to `tests/fixtures/`
- **No UI automation** — Streamlit is verified manually

## Out of Scope (potential v2)

- Save / load presets to JSON
- Webcam input
- Background subtraction (MOG2/KNN) detection mode
- Color-based filtering (only track objects of a specific color)
- Skeleton / pose tracking via MediaPipe
- Batch processing multiple files
- Audio-reactive parameter modulation

## Open Questions

None at design approval time. All clarifications resolved during brainstorming.
