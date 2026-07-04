# Contour VFX Overlay — Blob Tracker

[![CI](https://github.com/alexjiganov179-lab/blob-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/alexjiganov179-lab/blob-tracker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Live demo](https://img.shields.io/badge/demo-live-brightgreen.svg)](https://alexjiganov179-lab.github.io/blob-tracker/)

Browser-based real-time editor for Canny-based contour overlays on videos.
Inspired by artkit.cc/baby-track and whenistheweekend.com/vfx.html, free and offline.

**Try it now:** <https://alexjiganov179-lab.github.io/blob-tracker/>

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
- **Color and text controls** — separate Color and Text cards: 18-color palette with bilingual color-name tooltips, custom `#rrggbb` hex input, native color picker, and toggleable text labels with random / position / count content
- **Centroid dots** — optional tracking dots
- **Grouping** — keep raw contour fragments, or merge nearby fragments into a single region
- **Find Objects presets** — Sensitivity (Low / Balance / High), Object Size (Small / Medium / Large), and Detector (Edge / Motion / HSV / Area) hide the technical sliders; small-object tuning uses High + Small, and the Detector label includes an in-app tooltip
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

Open `online-version/index.html` in Chrome or Edge. OpenCV.js loads from a 3-CDN fallback chain with a retry button if all CDNs fail.

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
| **Find Objects** | Sensitivity preset (Low / Balance / High), Object Size preset (Small / Medium / Large), Detector mode (Edge / Motion / HSV / Area), Re-detect button |
| **Visual Effects** | 14 effects (Contour, Cross, Frame, L-Frame, X-Frame, Grid, Particle, Dash, Scope, Win2K, Backdrop, Emojis, Heatmap, Voronoi, Convex-Hull) |
| **Connection** | Nearest, all, chain, or waveform lines between blobs, with density and stroke-width controls in one card |
| **Stroke Width** | 0.5–10px |
| **Blob Size** | Min / Max area filters |
| **Detection** | Canny low / high, Gaussian blur, **Color Channel** (Lum / R / G / B), **GPU toggle**, centroid dots toggle |
| **Grouping** | Detail (raw contours) / Grouped (merge nearby fragments), with kernel + iterations |
| **Color** | 18-color palette with EN/RU hover names, custom `#rrggbb` hex input, native color picker |
| **Text** | Text on/off, position (Center / Top / Bottom), content (Random / Position / Count / ID), font size |
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
- **Internet on first load** for OpenCV.js and Mediabunny. OpenCV.js has a 3-CDN fallback chain (`docs.opencv.org` → `cdn.jsdelivr.net` → `unpkg.com`) with a user-facing retry if all fail. Once cached, the app runs offline.

## Known Limitations

- **Contour tracking, not object tracking** — IDs can flicker between frames for fast-moving or briefly occluded objects
- **Source-size export is RAM-heavy** — export allocates an offscreen canvas at the source video's original dimensions. Use smaller source media on low-RAM devices.
- **Preview resolution is downscaled** — detection runs on a frame sized to fit `MAX_PREVIEW_DIM`. Full-res export scales the preview coordinates to the target size with letterbox / pillarbox.
- **No multi-clip timeline, no keyframes, no webcam input** — see `PLAN.md` for the roadmap (Phases 4-6).

## Architecture

The project uses a **modular architecture** (primary: `online-version/`):

| File | Lines | Purpose |
|---|---|---|
| `index.html` | ~660 | Clean HTML structure (DOM, modals, CDN importmap, OpenCV loader) |
| `styles.css` | ~698 | All CSS styles (design system, layout, animations) |
| `app.js` | ~2362 | Core UI logic, state management, initialization, detection pipeline |
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

8 test files, 130 assertions across 10 scenarios, all green:

```bash
node tests/js/run-online-tests.mjs --scenario all   # 7 e2e scenarios (127 assertions)
node tests/js/test-opencv-fallback.mjs               # 3 CDN fallback / retry scenarios
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
| F1 | OpenCV primary blocked → fallback | ✅ |
| F2 | All OpenCV CDNs blocked → error UI | ✅ |
| F3 | Retry after unblock → recovers | ✅ |

See `tests/js/run-online-tests.mjs` and `tests/js/test-opencv-fallback.mjs` for details.

## Contributing, Security, License

- **Contributing** — see [`CONTRIBUTING.md`](./CONTRIBUTING.md) (EN + RU). Ideas and
  bug reports go in [Issues](https://github.com/alexjiganov179-lab/blob-tracker/issues);
  code changes go through pull requests reviewed by the maintainer.
- **Security** — found a vulnerability? Do **not** open a public issue. See
  [`SECURITY.md`](./SECURITY.md) and use
  [private vulnerability reporting](https://github.com/alexjiganov179-lab/blob-tracker/security/advisories/new).
- **Code of Conduct** — [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).
- **License** — MIT, see [`LICENSE`](./LICENSE). Third-party CDN dependencies
  keep their own licenses (Mediabunny MPL-2.0; OpenCV.js Apache-2.0).

## Documentation Index

| File | Contents |
|---|---|
| `online-version/SPEC.md` | Product specification (русский) |
| `online-version/IMPLEMENTATION-BRIEF.md` | Technical handoff for next agent |
| `online-version/PLAN-mediabunny.md` | Mediabunny integration status |
| `online-version/APOLOTARY-INVENTORY.md` | Historical Apolotary source inventory and current product-surface notes |
| `PLAN.md` | Development roadmap (Phases 1-6) |
| `gstack-design-review.md` | Design audit |
