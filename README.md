# Blob Tracker

[![CI](https://github.com/alexjiganov179-lab/blob-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/alexjiganov179-lab/blob-tracker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Live demo](https://img.shields.io/badge/demo-live-brightgreen.svg)](https://alexjiganov179-lab.github.io/blob-tracker/)

> I run [SHUM](https://www.instagram.com/studio.shum), a multimedia studio. One day I wanted to make a series of Instagram Reels under the theme *"Everything looks better with blob tracking effect on it"*. I looked for a quick tool — nothing fit. Yes, TouchDesigner can do this, but learning it for a handful of Reels felt like overkill. So I built my own. This is my first open-source project, and it's free for anyone to use.
>
> ---
>
> Однажды захотелось сделать серию Instagram Reels на тему «Everything looks better with blob tracking effect on it» для аккаунта [SHUM](https://www.instagram.com/studio.shum). Порылся — готового инструмента под рукой нет. TouchDesigner умеет, но изучать его ради пары рилсов принципиально не хотелось. Поэтому написал свой. Это мой первый open-source проект, и он бесплатен для всех.

**Try it now:** <https://alexjiganov179-lab.github.io/blob-tracker/>

## Features

- **14 visual effects** — Contour, Cross, Frame, L-Frame, X-Frame, Grid, Particle, Dash, Scope, Win2K, Backdrop, Emojis, Heatmap, Voronoi, Convex-Hull
- **4 detector modes** — Edge, Motion, HSV, Area
- **Connecting lines** — nearest, all, chain, or waveform between blobs, with rate control
- **Color and text controls** — separate Color and Text cards: 18-color palette with bilingual color-name tooltips, custom `#rrggbb` hex input, native color picker, and toggleable text labels with random / position / count content
- **GPU Acceleration** — WebGL2 pipeline for blur + Sobel edge detection (5-10x faster than CPU OpenCV)
- **Color Channel Select** — detect on Luminance, Red, Green, or Blue channel (like TouchDesigner)
- **Source-size export** — exports at the loaded video's original width, height, and aspect ratio
- **Three export engines** — Mediabunny (MP4 + WebM with audio), WebCodecs H.264 (MP4 fallback), MediaRecorder WebM (legacy fallback)
- **English / Russian interface** — language toggle in the panel footer and About dialog

## Getting Started

Open `online-version/index.html` locally in Chrome or Edge, or use the
[live online version](https://alexjiganov179-lab.github.io/blob-tracker/).
OpenCV.js loads from a 3-CDN fallback chain with a retry button if all CDNs fail.

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
| **Detection** | Canny low / high, Gaussian blur, Color Channel (Lum / R / G / B), GPU toggle, centroid dots toggle, with inline tooltips for each Detect control |
| **Grouping** | Merge slider: `1` keeps raw/detail contours, higher values merge nearby fragments into larger blobs |
| **Color** | 18-color palette with EN/RU hover names, custom `#rrggbb` hex input, native color picker |
| **Text** | Text on/off, position (Center / Top / Bottom), content (Random / Position / Count / ID), font size |
| **Output** | Output FPS (Source / 30 / 60), Codec (MP4 / WebM). Output size is always the source video size. |

## Export Format

| Format | Engine | Audio | Best for |
|---|---|---|---|
| **MP4** | Mediabunny (AVC/H.264 + AAC) | ✅ AAC passthrough (desktop) / ❌ video-only on mobile | Social sharing, Instagram Reels / Stories |
| **WebM** | Mediabunny (VP9 + Opus) | ✅ Opus passthrough (desktop) / ❌ video-only on mobile | Firefox / Safari, open formats |
| **MP4 (fallback)** | WebCodecs H.264 → `mp4-muxer` | ❌ video only | Legacy Chrome without Mediabunny |
| **WebM (fallback)** | `MediaRecorder` on `canvas.captureStream(0)` | ❌ video only | Legacy Firefox / Safari |

MP4 files use `fastStart: "in-memory"` so the `moov` box is at the front and the file is web-streamable without a post-process.

The export pipeline checks `audioTrack.canDecode()` before registering the audio track, so an undecodable audio codec (common on mobile) produces a clean video-only file instead of crashing the export. Any audio error mid-export is logged and the video-only result is still delivered.

If the browser reclaims the WebCodecs MP4 encoder during a slow 60 FPS export,
the app logs the failure and retries through the WebM fallback so the user still
gets an exported file.

### Requirements

- **Desktop Chrome or Edge** recommended for the full experience (Mediabunny + audio). Desktop Firefox / Safari fall back to WebM via MediaRecorder.
- **Mobile browsers (iOS Safari, Android Chrome)** can detect, preview, and export, but the exported file will likely have **no audio**: mobile WebCodecs `AudioDecoder` cannot decode most audio codecs (Opus/MP3 in MP4, some AAC profiles). The app shows an in-app notice to mobile users in the Output card and silently exports video-only. For audio, export on a desktop browser.
- **Internet on first load** for OpenCV.js and Mediabunny. OpenCV.js has a 3-CDN fallback chain (`docs.opencv.org` → `cdn.jsdelivr.net` → `unpkg.com`) with a user-facing retry if all fail. Once cached, the app runs offline.

## Known Limitations

- **Contour tracking, not object tracking** — IDs can flicker between frames for fast-moving or briefly occluded objects
- **Mobile export is video-only** — iOS Safari and Android Chrome reject most audio codecs in WebCodecs `AudioDecoder`, so the export pipeline pre-checks `audioTrack.canDecode()` and exports video-only when audio is not decodable. A visible notice in the Output card warns mobile users before export.
- **Source-size export is RAM-heavy** — export allocates an offscreen canvas at the source video's original dimensions. Use smaller source media on low-RAM devices.
- **Preview resolution is downscaled** — detection runs on a frame sized to fit `MAX_PREVIEW_DIM`. Full-res export scales the preview coordinates to the target size with letterbox / pillarbox.
- **No multi-clip timeline, no keyframes, no webcam input**.

## Architecture

The project uses a **modular architecture** in `online-version/`:

| File | Lines | Purpose |
|---|---|---|
| `index.html` | ~680 | Clean HTML structure (DOM, modals, CDN importmap, OpenCV loader) |
| `styles.css` | ~760 | All CSS styles (design system, layout, animations) |
| `app.js` | ~2360 | Core UI logic, state management, initialization, detection pipeline |
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

Main checks:

```bash
node tests/js/run-online-tests.mjs          # 7 e2e scenarios, 127 assertions locally
node tests/js/test-opencv-fallback.mjs      # 3 CDN fallback / retry scenarios, 24 assertions
node tests/js/test_centroid_tracker.mjs     # 5 tracker unit checks
node tests/js/check_syntax.mjs              # inline script syntax in online-version/index.html
```

GitHub Actions skips scenario 1 (MP4 + AAC) because Linux headless Chromium does
not reliably complete AAC-in-MP4 downloads. The full suite is green locally in
desktop Chrome / Edge.

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

## Acknowledgments

- **[Apolotary/blob-tracker](https://github.com/Apolotary/blob-tracker)** — original Python project whose detector/visualizer/post-FX architecture inspired this port
- **[Vanilagy/mediabunny](https://github.com/Vanilagy/mediabunny)** — export engine powering MP4 and WebM output with audio passthrough
- **[Vanilagy/mp4-muxer](https://github.com/Vanilagy/mp4-muxer)** — H.264 packaging for the WebCodecs MP4 fallback
- **[@techstark/opencv-js](https://github.com/techstark/opencv-js)** — OpenCV.js distribution used for contour detection

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
