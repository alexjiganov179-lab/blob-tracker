# Contour VFX Overlay — Blob Tracker

Browser-based real-time editor for Canny-based contour overlays on videos.
Inspired by artkit.cc/baby-track and whenistheweekend.com/vfx.html, free and offline.

> **Primary development branch:** `online-version/` — modular, feature-complete, with audio export.
> The root `index.html` is the legacy single-file version.

## Features

- **Predictable detection start** — drop a video to prepare it, then start detection explicitly after choosing settings
- **Live re-detect** — change Canny / blur / blob-size sliders and re-detect without re-uploading
- **14 visual effects** — Contour, Cross, Frame, L-Frame, X-Frame, Grid, Particle, Dash, Scope, Win2K, Backdrop, Emojis, Heatmap, Voronoi, Convex-Hull
- **4 detector modes** — Edge, Motion, HSV, Area
- **Audio export** — AAC (MP4) and Opus (WebM) passthrough via Mediabunny
- **Playback controls** — pause/play, scrub the timeline, and inspect a paused frame before export
- **Current-frame detection probe** — tune detection sliders on the paused frame before running a full re-detect
- **Connecting lines** — nearest, all, chain, or waveform between blobs, with rate control
- **Color & text** — 18-color palette with bilingual color-name tooltips, custom `#rrggbb` hex input, native color picker, and toggleable text labels with random / position / count content
- **Centroid dots** — optional tracking dots
- **Grouping** — keep raw contour fragments, or merge nearby fragments into a single region
- **Find Objects presets** — Sensitivity (Low / Normal / High / Tiny), Object Size (Small / Medium / Large), and Detector (Edge / Motion / HSV / Area) hide the technical sliders; the Detector label includes an in-app tooltip
- **GPU Acceleration** — WebGL2 pipeline for blur + Sobel edge detection (5-10x faster than CPU OpenCV)
- **Color Channel Select** — detect on Luminance, Red, Green, or Blue channel (like TouchDesigner)
- **Source-size export** — exports at the loaded video's original width, height, and aspect ratio
- **Three export engines** — Mediabunny (MP4 + WebM with audio), WebCodecs H.264 (MP4 fallback), MediaRecorder WebM (legacy fallback)
- **MP4 recovery fallback** — if Chrome reclaims an inactive WebCodecs MP4 encoder, export retries as WebM instead of failing completely
- **Smart codec probe** — prefers H.264 High Profile (Level 4.0) for 1080p / Instagram output, Baseline 3.1 for preview
- **Cancel detection / export** — abort long operations without reloading the page
- **Debug logger** — copy a timestamped log of all events and parameter snapshots
- **English / Russian interface** — language toggle in the panel footer and About dialog

## Getting Started

Open `online-version/index.html` in Chrome or Edge. OpenCV.js loads from CDN.

1. **Drop a video** anywhere on the page (or click Upload) to load the preview
2. **Choose detection settings** in Find Objects / Detect before analysis starts
3. **Pick a visual style** and optional effects
4. **Click Start detection** to run analysis with the current settings
5. **Pick Output FPS and Codec** (Source / 30 / 60, MP4 / WebM)
6. **Confirm FPS changes** when switching to 30 or 60 FPS after detection; this starts a re-detect pass
7. **Click Export** → file downloads automatically with audio. Use cancel controls to abort long runs

## Parameter Overview

| Section | Controls |
|---|---|
| **Find Objects** | Sensitivity preset (Low / Normal / High / Tiny), Object Size preset (Small / Medium / Large), Detector mode (Edge / Motion / HSV / Area), Re-detect button |
| **Visual Effects** | 14 effects (Contour, Cross, Frame, L-Frame, X-Frame, Grid, Particle, Dash, Scope, Win2K, Backdrop, Emojis, Heatmap, Voronoi, Convex-Hull) |
| **Connection** | Nearest, all, chain, or waveform lines between blobs, with density and stroke-width controls in one card |
| **Stroke Width** | 0.5–10px |
| **Blob Size** | Min / Max area filters |
| **Detection** | Canny low / high, Gaussian blur, **Color Channel** (Lum / R / G / B), **GPU toggle** |
| **Grouping** | Detail (raw contours) / Grouped (merge nearby fragments), with kernel + iterations |
| **Color & Text** | 18-color palette with EN/RU hover names, custom `#rrggbb` hex input, native color picker, text on/off, position (Center / Top / Bottom), content (Random / Position / Count / ID), font size |
| **Centroid** | Show tracking dots on/off |
| **Output** | Output FPS (Source / 30 / 60), Codec (MP4 / WebM). Output size is always the source video size. |

## Export Format

| Format | Engine | Audio | Best for |
|---|---|---|---|
| **MP4** | Mediabunny (AVC/H.264 + AAC) | ✅ AAC passthrough | Social sharing, Instagram Reels / Stories |
| **WebM** | Mediabunny (VP9 + Opus) | ✅ Opus passthrough | Firefox / Safari, open formats |
| **MP4 (fallback)** | WebCodecs H.264 → `mp4-muxer` | ❌ video only | Legacy Chrome without Mediabunny |
| **WebM (fallback)** | `MediaRecorder` on `canvas.captureStream(0)` | ❌ video only | Legacy Firefox / Safari |

MP4 files use `fastStart: "in-memory"` so the `moov` box is at the front and the file is web-streamable without a post-process.

If the browser reclaims the WebCodecs MP4 encoder during a slow 60 FPS export,
the app logs the failure and retries through the WebM fallback so the user still
gets an exported file.

### Requirements

- **Chrome or Edge** recommended for the full experience (Mediabunny + audio). Firefox / Safari fall back to WebM via MediaRecorder.
- **Internet on first load** for OpenCV.js and Mediabunny. Once cached, the app runs offline.

## Known Limitations

- **Contour tracking, not object tracking** — IDs can flicker between frames for fast-moving or briefly occluded objects
- **Source-size export is RAM-heavy** — export allocates an offscreen canvas at the source video's original dimensions. Use smaller source media on low-RAM devices.
- **Preview resolution is downscaled** — detection runs on a frame sized to fit `MAX_PREVIEW_DIM`. Full-res export scales the preview coordinates to the target size with letterbox / pillarbox.
- **No multi-clip timeline, no keyframes, no webcam input** — see `PLAN.md` for the roadmap (Phases 4-6).

## Architecture

The project uses a **modular architecture** (primary: `online-version/`):

| File | Lines | Purpose |
|---|---|---|
| `index.html` | ~470 | Clean HTML structure (DOM, modals, CDN importmap) |
| `styles.css` | ~698 | All CSS styles (design system, layout, animations) |
| `app.js` | ~2202 | Core UI logic, state management, initialization, detection pipeline |
| `effects.js` | ~342 | 14 visual effects |
| `export.js` | ~480 | Export pipeline (Mediabunny MP4/WebM, native fallbacks, audio passthrough) |

Benefits:
- **Modular testing** — each component can be tested independently
- **Git-friendly** — parallel development without merge conflicts
- **Fast IDE** — quick syntax highlighting and navigation
- **Easy maintainability** — clear separation of concerns

## Development Notes

When changing `online-version/styles.css`, `online-version/app.js`, `online-version/effects.js`, or `online-version/export.js`, update the matching `?v=...` query string in `online-version/index.html`. Browser cache can otherwise keep old JS/CSS active while newer HTML is visible.

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
| 5 | Vertical source-size → MP4 | ✅ |
| 6 | 60 FPS → Source FPS | ✅ |
| 7 | Cancel export (long video) | ✅ |

See `tests/js/run-online-tests.mjs` for details.

## Documentation Index

| File | Contents |
|---|---|
| `online-version/SPEC.md` | Product specification (русский) |
| `online-version/IMPLEMENTATION-BRIEF.md` | Technical handoff for next agent |
| `online-version/PLAN-mediabunny.md` | Mediabunny integration status |
| `online-version/APOLOTARY-INVENTORY.md` | Historical Apolotary source inventory and current product-surface notes |
| `PLAN.md` | Development roadmap (Phases 1-6) |
| `gstack-design-review.md` | Design audit |
