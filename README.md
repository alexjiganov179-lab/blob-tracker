# Contour VFX Overlay — Blob Tracker

Browser-based real-time editor for Canny-based contour overlays on videos.
Inspired by artkit.cc/baby-track and whenistheweekend.com/vfx.html, free and offline.

> **Primary development branch:** `online-version/` — modular, feature-complete, with audio export.
> The root `index.html` is the legacy single-file version.

## Features

- **Predictable detection start** — drop a video to prepare it, then start detection explicitly after choosing settings
- **Live re-detect** — change Canny / blur / blob-size sliders and re-detect without re-uploading
- **24 visual effects** — Outline, BBox, Crosshair, Corner-Ticks, Letters, Emojis, Glyphs, Silhouette, CCTV-Zoom, Spatial-Echo, Heatmap, Voronoi, Convex-Hull, Trail, Network, Outline, Label, Dash, Grid, X-Frame, Scope, Win2K, Backdrop, Particle
- **13 post-FX** — Mosaic, Scanlines, Chroma, RGB-Shift, Luma-LUT, Thresh-Band, Ripple, LagFun, Feedback, Jitter, YUV-Split, Slit-Scan, Edge-Glow
- **11 detector modes** — Edge, Motion-Diff, Color-HSV, Contour-Area, Simple-Blob, Circles, DoG, Flow, Accumulation, Watershed, Color-Cluster
- **Audio reactivity** — RMS amp, kick, high, onset modulate stroke width, glow, particles, network, trails, and post-FX in real time
- **Audio export** — AAC (MP4) and Opus (WebM) passthrough via Mediabunny
- **Motion-blur trails** — Trail effect composites up to 30 decaying canvas copies for a true motion-blur look
- **Connecting lines** — nearest, all, chain, or waveform between blobs, with rate control
- **Color & text** — 18-color palette, toggleable text labels with random / position / count content
- **Centroid dots** — optional tracking dots
- **Grouping** — keep raw contour fragments, or merge nearby fragments into a single region
- **Find Objects presets** — Sensitivity (Low / Normal / High / Tiny) and Object Size (Small / Normal / Large) hide the technical sliders
- **GPU Acceleration** — WebGL2 pipeline for blur + Sobel edge detection (5-10x faster than CPU OpenCV)
- **Color Channel Select** — detect on Luminance, Red, Green, or Blue channel (like TouchDesigner)
- **Multi-resolution export** — Preview (canvas size), 1080p (1920×1080 or 1080×1920 for portrait sources), or 9:16 (1080×1920 for Instagram Reels/Stories)
- **Three export engines** — Mediabunny (MP4 + WebM with audio), WebCodecs H.264 (MP4 fallback), MediaRecorder WebM (legacy fallback)
- **Smart codec probe** — prefers H.264 High Profile (Level 4.0) for 1080p / Instagram output, Baseline 3.1 for preview
- **Cancel detection / export** — abort long operations without reloading the page
- **Debug logger** — copy a timestamped log of all events and parameter snapshots
- **English / Russian interface** — language toggle in the panel footer and About dialog

## Getting Started

Open `online-version/index.html` in Chrome or Edge. OpenCV.js loads from CDN.

1. **Drop a video** anywhere on the page (or click Upload) to load the preview
2. **Choose detection settings** in Find Objects / Detect before analysis starts
3. **Pick a visual style** and optional effects such as **Trail**
4. **Click Start detection** to run analysis with the current settings
5. **Pick Output FPS and Codec** (Source / 30 / 60, MP4 / WebM)
6. **Confirm FPS changes** when switching to 30 or 60 FPS after detection; this starts a re-detect pass
7. **Click Export** → file downloads automatically with audio. Use cancel controls to abort long runs

## Parameter Overview

| Section | Controls |
|---|---|
| **Find Objects** | Sensitivity preset (Low / Normal / High / Tiny), Object Size preset (Small / Normal / Large), Detector mode (Edge / Motion / HSV / Area / Blob / Circles / DoG / Flow / Accum / Watershed / K-Means), Re-detect button |
| **Video Speed** | 0.5× / 1× / 2× / 4× playback |
| **Visual Effects** | 24 effects (Outline, BBox, Crosshair, Corner-Ticks, Letters, Emojis, Glyphs, Silhouette, CCTV-Zoom, Spatial-Echo, Heatmap, Voronoi, Convex-Hull, Trail, Network, etc.) |
| **Post-FX** | 13 post-effects (Mosaic, Scanlines, Chroma, RGB-Shift, Luma-LUT, Thresh-Band, Ripple, LagFun, Feedback, Jitter, YUV-Split, Slit-Scan, Edge-Glow) |
| **Connection** | Network lines between blobs (all pairs within maxDist, alpha falloff) |
| **Stroke Width** | 0.5–10px |
| **Blob Size** | Min / Max area filters |
| **Detection** | Canny low / high, Gaussian blur, **Color Channel** (Lum / R / G / B), **GPU toggle** |
| **Grouping** | Detail (raw contours) / Grouped (merge nearby fragments), with kernel + iterations |
| **Color & Text** | 18-color palette, text on/off, position (Center / Top / Bottom), content (Random / Position / Count / ID), font size |
| **Centroid** | Show tracking dots on/off |
| **Audio** | Reactivity toggle + intensity slider (0–100%), modulates 12 effects + 4 PostFX |
| **Output** | Output FPS (Source / 30 / 60), Output Size (Preview / 1080p / 9:16), Codec (MP4 / WebM) |

## Export Format

| Format | Engine | Audio | Best for |
|---|---|---|---|
| **MP4** | Mediabunny (AVC/H.264 + AAC) | ✅ AAC passthrough | Social sharing, Instagram Reels / Stories |
| **WebM** | Mediabunny (VP9 + Opus) | ✅ Opus passthrough | Firefox / Safari, open formats |
| **MP4 (fallback)** | WebCodecs H.264 → `mp4-muxer` | ❌ video only | Legacy Chrome without Mediabunny |
| **WebM (fallback)** | `MediaRecorder` on `canvas.captureStream(0)` | ❌ video only | Legacy Firefox / Safari |

MP4 files use `fastStart: "in-memory"` so the `moov` box is at the front and the file is web-streamable without a post-process.

### Requirements

- **Chrome or Edge** recommended for the full experience (Mediabunny + audio). Firefox / Safari fall back to WebM via MediaRecorder.
- **Internet on first load** for OpenCV.js and Mediabunny. Once cached, the app runs offline.

## Known Limitations

- **Contour tracking, not object tracking** — IDs can flicker between frames for fast-moving or briefly occluded objects
- **Trail and full-res export are RAM-heavy** — Trail keeps up to 30 canvas copies in memory; 1080p export allocates a 1920×1080 offscreen canvas. Lower the trail length or pick the Preview size on low-RAM devices.
- **Preview resolution is downscaled** — detection runs on a frame sized to fit `MAX_PREVIEW_DIM`. Full-res export scales the preview coordinates to the target size with letterbox / pillarbox.
- **No multi-clip timeline, no keyframes, no webcam input** — see `PLAN.md` for the roadmap (Phases 4-6).

## Architecture

The project uses a **modular architecture** (primary: `online-version/`):

| File | Lines | Purpose |
|---|---|---|
| `index.html` | ~451 | Clean HTML structure (DOM, modals, CDN importmap) |
| `styles.css` | ~293 | All CSS styles (design system, layout, animations) |
| `app.js` | ~1561 | Core UI logic, state management, initialization, detection pipeline |
| `effects.js` | ~546 | 24 visual effects + 13 post-FX + audio modulation |
| `export.js` | ~409 | Export pipeline (Mediabunny MP4/WebM, native fallbacks, audio passthrough) |

Benefits:
- **Modular testing** — each component can be tested independently
- **Git-friendly** — parallel development without merge conflicts
- **Fast IDE** — quick syntax highlighting and navigation
- **Easy maintainability** — clear separation of concerns

## Test Suite

7 end-to-end scenarios, 82 assertions, all green:

```bash
node tests/js/run-online-tests.mjs --scenario all
```

| # | Scenario | Result |
|---|---|---|
| 1 | H.264 + AAC → MP4 | ✅ |
| 2 | H.264 + AAC → WebM | ✅ |
| 3 | Video-only → MP4 | ✅ |
| 4 | Video-only → WebM | ✅ |
| 5 | Vertical 9:16 → MP4 1080p | ✅ |
| 6 | 60 FPS → Source FPS | ✅ |
| 7 | Cancel export (long video) | ✅ |

See `tests/js/run-online-tests.mjs` for details.

## Documentation Index

| File | Contents |
|---|---|
| `online-version/SPEC.md` | Product specification (русский) |
| `online-version/IMPLEMENTATION-BRIEF.md` | Technical handoff for next agent |
| `online-version/PLAN-mediabunny.md` | Mediabunny integration status |
| `online-version/APOLOTARY-INVENTORY.md` | Full inventory of 48 ported effects |
| `PLAN.md` | Development roadmap (Phases 1-6) |
| `gstack-design-review.md` | Design audit |
