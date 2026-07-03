# blob_tracker — Online Version

> Pre-release development version. It is not approved for public deployment.

`blob_tracker online` is a desktop browser VFX tool for applying contour,
tracking, and generative effects to a local video. The source video is processed
in the browser and is not uploaded to a blob_tracker server.

## Current capabilities

- Local single-video input with file validation (size ≤500 MB, format check, duration warning)
- OpenCV.js contour detection
- Playback controls: play/pause, timeline scrubbing, and current-frame preview while paused
- Current-frame detection probe for paused detection tuning before a full Re-detect
- 24 visual effects (outline, crosshair, corner-ticks, letters, emojis, glyphs, silhouette, CCTV-zoom, spatial-echo, heatmap, Voronoi, convex-hull, trail, glow, backdrop, dash, grid, x-frame, scope, win2k, label, bbox, network, particle)
- 13 post-FX (mosaic, scanlines, chroma, rgb-shift, luma-lut, thresh-band, ripple, lagfun, feedback, jitter, yuv-split, slit-scan)
- 11 detector modes (edge, motion-diff, color-hsv, contour-area, simple-blob, circles, DoG, flow, accumulation, K-means, watershed)
- **Audio reactivity** — per-frame RMS, kick, high, onset features modulate stroke width, glow, particles, network, trails, and post-FX in real time
- Output frame rate: source, 30, or 60 FPS
- Output dimensions: always the source video's original width, height, and aspect ratio
- MP4 and WebM export through Mediabunny 1.49.0 with audio passthrough
- Automatic video-codec selection
- Detection and export progress
- Detection and export cancellation
- **User-friendly error messages** — differentiated for video, audio, codec, CDN, and memory failures
- **English / Russian interface** — language toggle in the panel footer and About dialog
- **About dialog** — built-in info panel covering capabilities, privacy, limitations, and links

## Export status

Mediabunny 1.49.0 integration is verified. Both MP4 and WebM export work
with and without audio. Source-size export, playback controls, current-frame
probe, and post-export playback recovery are covered by the current online test
scenarios. See `PLAN-mediabunny.md` for the broader Mediabunny audit history.

## Modular refactoring (24 June 2026)

The online version has been refactored from a single `index.html` (~3131 lines)
into a modular architecture:

- `index.html` (~451 lines) — DOM structure, CDN loading, modals
- `styles.css` (~293 lines) — design system extracted from inline styles
- `app.js` — core logic, UI, detection pipeline
- `effects.js` (~546 lines) — all 24 visual effects + 13 post-FX + audio modulation
- `export.js` (~409 lines) — Mediabunny export + native fallbacks (MP4/WebM/audio)

## Export behavior

Export is not a pixel-for-pixel copy of the source. The app redraws the source
video and selected effects to a Canvas and re-encodes the result.

The user can select:

- source, 30, or 60 FPS;
- MP4 or WebM.

The exported video always uses the loaded source video's original pixel
dimensions and aspect ratio. The online interface intentionally does not expose
separate output-size presets.

Exported files include synchronized audio when the source has an audio track.

## Runtime and privacy

The app has no video-processing backend. OpenCV.js and Mediabunny are loaded
from third-party CDNs, so the first load requires internet access. The local
video itself is not sent to those CDNs by the application.

**OpenCV.js reliability**: OpenCV.js (~17MB) loads from primary CDN with automatic
fallback to secondary CDN. Users see loading indicator during download, and if both
CDNs fail, clear error messages with retry option are shown.

## Documentation

- `SPEC.md` — product scope, roadmap, and release rules
- `PLAN-mediabunny.md` — current Mediabunny audit and remaining work
- `IMPLEMENTATION-BRIEF.md` — handoff for the next implementation agent
- `APOLOTARY-INVENTORY.md` — full inventory of ported Apolotary effects (48 items)
- `tests/js/run-online-tests.mjs` — 7 end-to-end test scenarios (82 assertions)

## Release rule

Do not create a public repository, enable GitHub Pages, or deploy this version
until all agreed Apolotary effects are implemented, the project author has
personally tested the release candidate, and the author has given a separate
explicit instruction to publish it.

## License

blob_tracker is MIT licensed; see `LICENSE`. Mediabunny is loaded from its
official package distribution under MPL-2.0.
