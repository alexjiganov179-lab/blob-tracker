# Contour VFX Overlay — Streamlit App for Reels

**Status:** Design approved (revised after review), ready for implementation plan
**Date:** 2026-05-02

## Purpose

Local Streamlit application that adds a "computer-vision debug" visual overlay to videos — Canny-based contours, semi-transparent fills, bounding boxes, ID labels and motion trails — for producing Instagram Reels in the "everything looks better with blob tracking on it" aesthetic. Inspired by paid web tools like artkit.cc/baby-track and whenistheweekend.com/vfx.html, but free and runs locally.

The user uploads a video file, picks a preset and tweaks parameters with a downscaled live preview, and exports the result as an MP4 with the original audio preserved.

### Honest framing

This is a **contour VFX overlay**, not a stable object tracker. Canny + contour finding will latch onto clothing seams, textures, shadows and background edges. ID numbers and trails will flicker and reassign as contours appear/disappear between frames. That instability is part of the aesthetic. The app delivers a stylistic effect, not reliable object identity.

## Non-Goals

- Webcam / live capture (file-only input)
- Skeleton / pose tracking (MediaPipe-style)
- Background subtraction or motion-only filtering (planned for v2)
- Stable object tracking with persistent identity
- Multi-user / cloud deployment
- Plugin / preset marketplace, batch processing, mobile UI

## User Flow

1. User launches the app via `streamlit run app.py`
2. User drops an MP4/MOV/MKV file into the upload area
3. App probes metadata, builds a downscaled preview clip (~540×960, full duration), shows looping preview with the default preset
4. User picks a preset or adjusts parameters; preview re-renders within ~1–2 sec on changes
5. User clicks "Export MP4" → full-resolution streaming render with audio (~10–30 sec depending on length) → download button

## Architecture

### Stack

- Python 3.11+
- Streamlit (UI)
- OpenCV (`opencv-python`) — frame processing, edge detection, contour finding, drawing
- NumPy — frames as arrays
- FFmpeg (system binary, already installed) — video probe, crop, encode, audio mux
- `ffmpeg-python` wrapper for cleaner subprocess calls

### File Structure

```
blob_tracker/
├── app.py                  # Streamlit entrypoint, wires UI ↔ pipeline
├── requirements.txt
├── README.md
├── presets.json            # Default presets (Neon Debug, Minimal White, ...)
├── processing/             # Pure logic, no Streamlit imports
│   ├── __init__.py
│   ├── detection.py        # Canny edge detection, contour finding, ID tracking
│   ├── rendering.py        # Layer drawing (contour/fill/box/labels/trail/centroid)
│   ├── pipeline.py         # Streaming frame iterator → detect → render → output frame
│   ├── preview.py          # Build downscaled preview clip, cache key helpers
│   └── export.py           # Full-resolution streaming export with audio preservation
├── ui/                     # Streamlit components only
│   ├── __init__.py
│   ├── sections.py         # Collapsible parameter sections + preset bar
│   └── player.py           # Looping video preview component
├── .streamlit/
│   └── config.toml         # Theme, layout
└── tests/
    ├── fixtures/           # Short test videos
    └── test_processing.py  # Unit tests
```

### Separation of Concerns

- `processing/` is pure functions on numpy arrays / file paths / parameter dicts. No Streamlit imports. Unit-testable. Re-usable from a future CLI.
- `ui/` only contains Streamlit widget code. Reads / writes `st.session_state["params"]`. Does not call OpenCV directly.
- `app.py` glues them together.

## Processing Pipeline

The pipeline is **streaming** — frames flow through `cv2.VideoCapture` (or an ffmpeg pipe) one at a time. The app never holds all frames of the source video in RAM at once.

There are two pipelines: **preview** (downscaled, cached) and **export** (full-res, streaming, on-demand).

### On Video Upload

```
upload mp4
  → ffprobe → metadata: fps, frame count, duration, src_width, src_height,
                        has_audio, audio_codec
  → store original at temp_source.mp4 (used as audio source on export)
  → BUILD PREVIEW CLIP (one-time per file + crop_offset):
      ffmpeg -i temp_source.mp4
             -vf "crop=ih*9/16:ih:offset_x:0,scale=540:960"
             -an -c:v libx264 -preset ultrafast -crf 23
             temp_preview_src.mp4
      → preview is full duration, downscaled to 540×960, no audio
```

The 540×960 preview is the entire video at low resolution. All interactive editing happens against this clip. Memory at any moment: a handful of in-flight frames, not the whole array.

### On Detection Parameter Change (preview path)

```
temp_preview_src.mp4 (file path) + detection_params
  → cv2.VideoCapture, iterate frames:
      grayscale → GaussianBlur(odd kernel) → Canny(low, high)
      → findContours(RETR_EXTERNAL, CHAIN_APPROX_SIMPLE)
      → filter contours where min_blob_size ≤ area ≤ max_blob_size
  → derive per-blob: centroid, bbox, area
  → run centroid tracker (see ID Tracking section)
  → result: List[List[BlobRecord]] for the preview clip only
  (cached by (preview_path_hash, detection_params))
```

The preview is at most 540×960 × N frames worth of detection data — small.

### On Render Parameter Change (preview path)

```
preview frames (from VideoCapture, streamed) + cached blobs + render_params
  → for each frame, draw enabled layers in order:
      1. fill        (alpha-blend filled polygons onto a copy)
      2. contour     (drawContours, optional convex_hull, approxPolyDP)
      3. bounding box (rectangle)
      4. trail       (overlay-decay technique, see Trail Implementation)
      5. centroid    (filled circle)
      6. labels      (putText for ID / area / coords)
  → encode rendered frames to temp_preview_render.mp4
     (H.264, ultrafast preset, CRF 23, yuv420p)
  → return Path
  (cached by (preview_path_hash, detection_params, render_params))
```

A change to a render-only parameter (color, thickness, toggle) reuses the cached blobs and only re-runs rendering.

### On Export (full-resolution streaming)

Triggered by the "Export MP4" button. Does NOT use `st.cache_data` — exports are one-shot with progress UI and explicit temp-file management.

```
temp_source.mp4 + crop_offset + detection_params + render_params
  → ffmpeg crop to 9:16 at FULL resolution, pipe rawvideo to stdin of:
  → Python streaming worker:
      for each frame from the pipe:
          run detection (Canny + contours + filter)
          update centroid tracker (running state)
          draw enabled layers
          write frame to ffmpeg encoder pipe (H.264, CRF 18)
          yield progress to st.progress
  → output: temp_export_video.mp4 (silent)
  → audio mux pass:
      try: ffmpeg -i temp_export_video.mp4 -i temp_source.mp4 \
                  -map 0:v -map 1:a? -c:v copy -c:a copy output.mp4
      on failure (incompatible audio codec): re-run with -c:a aac -b:a 192k
  → st.download_button("Download", "output.mp4")
```

Audio is preserved by stream-copy when possible, transcoded to AAC only as a fallback. Memory during export stays bounded — only a small frame buffer ever lives in Python.

### Caching Strategy (preview only)

```python
@st.cache_data
def build_preview_clip(source_hash, crop_offset) -> Path:
    """Returns path to temp_preview_src.mp4 (540×960, full duration, no audio)."""

@st.cache_data
def detect_contours_for_preview(preview_path, detection_params) -> list[list[BlobRecord]]:
    """Per-frame blob records for the preview clip."""

@st.cache_data
def render_preview_video(preview_path, detection_params, render_params) -> Path:
    """Returns path to rendered preview MP4."""
```

Hierarchy:
- Change `crop_offset` → invalidates everything (new preview source)
- Change `detection_params` → invalidates step 2 and 3
- Change `render_params` only → invalidates only step 3

Export does not flow through `st.cache_data`.

### Performance Targets (Ryzen 5 1600X, 16GB RAM)

For a 15-second 1080p source clip:

- Preview clip build: ≤ 5 sec (one-time per file + crop)
- Detection on preview (540×960, ~450 frames): ≤ 4 sec
- Render preview: 1–2 sec
- Final full-resolution export: 15–30 sec (one-pass streaming + audio mux)

For 60-second sources, the preview path scales linearly (~16 sec detection); export ~60–120 sec. RAM usage stays under 1 GB at all times because frames stream.

## ID Tracking

A simple centroid tracker (~50 lines in `detection.py`):

- For each new frame, compute centroids of all detected blobs
- For each centroid, find the nearest centroid in the previous frame within `max_distance`
- If found → carry over the ID; if not → assign a new ID
- Maintain per-ID centroid history of last `trail_length` points

`max_distance` is computed at runtime as `0.05 × frame_diagonal_pixels` (5% of the frame diagonal). Hardcoded constant in `detection.py`, not exposed in UI v1.

Limitation acknowledged: ID assignment is unstable for fast motion or noisy contours; flicker and renumbering are expected.

## Trail Implementation

Naive per-segment polyline drawing with varying alpha is O(N) draw calls per frame. Instead, use the **decaying-overlay technique**:

- Keep a separate persistent `trail_overlay` numpy array, same dims as the frame, initialized to zeros (transparent black)
- Per frame, before drawing the trail layer:
  - Multiply the overlay by a `trail_decay_factor` (e.g., 0.92) → old marks fade
  - Draw new line segments from each blob's previous centroid to its current centroid onto the overlay (one `cv2.line` call per blob, full opacity)
- Composite `trail_overlay` onto the rendered frame with additive or alpha blend

This gives a continuous fading trail at constant cost per frame regardless of trail length. `trail_decay_factor` is derived from the UI's `trail_length`: `decay = exp(-1 / trail_length)`.

## UI Structure

### Layout

```
┌─────────────────────────────┬─────────────────────┐
│ [Upload]                    │ Presets:            │
│                             │ [Neon] [White] [..] │
│ ┌───────────────────────┐   │                     │
│ │  Looping preview      │   │ ▼ Detection         │
│ │  (540×960 downscaled) │   │   Crop offset: ──●  │
│ │                       │   │   Canny low:   ──●  │
│ │                       │   │   Canny high:  ──●  │
│ └───────────────────────┘   │   Min size:    ──●  │
│ ⏱ Looping (built-in)        │   Max size:    ──●  │
│                             │   Blur:        ──●  │
│ [⬇ Export Full-Res MP4]     │                     │
│                             │ ▼ Contour    [ON]   │
│                             │ ▶ Fill       [OFF]  │
│                             │ ▶ Bounding box [ON] │
│                             │ ▶ Trail      [OFF]  │
│                             │ ▶ Centroid   [OFF]  │
│                             │ ▶ Labels     [ON]   │
│                             │                     │
│                             │ [Reset to defaults] │
└─────────────────────────────┴─────────────────────┘
```

The preview uses Streamlit's built-in `st.video(path, loop=True, autoplay=True, muted=True)`. No custom playback controls — Streamlit's HTML5 video element provides play/pause/seek built-in.

### Presets

A row of preset buttons sits at the top of the parameter panel. Clicking a preset writes its full parameter dict into `st.session_state["params"]` and reruns. Defaults shipped in `presets.json`:

- **Neon Debug** — bright cyan contours, magenta bboxes, ID + area labels, no fill
- **Minimal White** — thin white contours only, no labels, no bboxes
- **Bounding Boxes** — yellow bboxes + IDs, no contours
- **Blob Fill** — semi-transparent magenta fills, thin contour, no labels
- **Glitch** — multicolor contours (color cycles per ID), heavy trails, no labels

### Parameter Sections

Each section after Detection has a master toggle. When off, that layer is skipped at render time.

| Section | Always-on? | Parameters |
|---|---|---|
| **Detection** | yes | crop_offset (-1.0..+1.0, default 0), canny_low (0–255), canny_high (0–255), min_blob_size (px²), max_blob_size (px²), blur_kernel (odd, 1–31, step 2) |
| **Contour** | toggle | color, thickness (1–10), epsilon_ratio (0.0–0.05, fraction of arcLength), use_convex_hull (bool) |
| **Fill** | toggle | color, opacity (0.0–1.0) |
| **Bounding box** | toggle | color, thickness (1–6) |
| **Trail** | toggle | length_frames (5–60, controls decay factor), color (or "match contour"), thickness (1–6) |
| **Centroid** | toggle | color, radius (2–20) |
| **Labels** | toggle | show_id, show_area, show_coords, font_size (8–24), text_color, bg_color (RGBA) |

`crop_offset = 0` is center crop; -1 is hard left, +1 is hard right (clamped so the crop stays inside the source).

### State Management

All parameter values live in `st.session_state["params"]` as a single dict. Each widget's `key=` reads/writes its corresponding entry. The pipeline functions take `params` as input. "Reset to defaults" clears the dict and reruns.

## Error Handling

| Condition | Behavior |
|---|---|
| Non-video file uploaded | `st.error("Failed to read video. Supported: mp4, mov, mkv.")` |
| Source has no audio stream | Export skips audio mux, info banner shown |
| FFmpeg not found in PATH | `st.error` with install hint |
| Source longer than 120 sec | Warning banner + "Proceed anyway" checkbox |
| Frame extraction returns 0 blobs | Frame rendered with no overlays (silent) |
| Audio stream-copy fails | Automatic fallback to AAC re-encode (logged in UI as info) |
| Crop offset would push crop outside source | Clamp to valid range silently |

Memory pressure is not an expected error condition because the pipeline is streaming. If it occurs anyway (e.g., unreasonably high resolution), it's an OS-level error and not specifically handled.

## Testing

- **Unit tests** in `tests/test_processing.py`:
  - `detect_contours` filters by `min_blob_size` and `max_blob_size`
  - `render_frame` skips layers when their toggle is off (compare pixel-equal to baseline)
  - Centroid tracker assigns the same ID to a slowly-moving blob and a new ID to one that teleports beyond `max_distance`
  - Trail overlay decays over multiple frames (alpha after N steps within tolerance of `decay^N`)
  - Crop offset clamping stays within valid range for edge cases
- **Integration test:** end-to-end on a 2-second fixture video — verify the export produces a valid MP4 with audio that ffprobe can read
- **Test fixtures:** 2 short videos (~2 sec, 480p) committed to `tests/fixtures/`
- **No UI automation** — Streamlit verified manually

## Out of Scope (potential v2)

- Save / load custom user presets to disk
- Webcam input
- Background subtraction (MOG2/KNN) detection mode for motion-only filtering
- Color-based filtering (track only objects of a specific color)
- Skeleton / pose tracking via MediaPipe
- Batch processing multiple files
- Audio-reactive parameter modulation
- Manual ID re-assignment / locking

## Open Questions

None at design approval time.
