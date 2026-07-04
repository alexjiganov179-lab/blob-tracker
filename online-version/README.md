# Blob Tracker — Online Version

Blob Tracker is a desktop browser VFX tool for applying contour,
tracking, and generative effects to a local video. The source video is processed
in the browser and is not uploaded to a Blob Tracker server.

## Current capabilities

- Local single-video input with file validation (size ≤500 MB, format check, duration warning)
- Explicit detection start: loading a video prepares preview/settings, and analysis starts only after `Start detection`
- OpenCV.js contour detection
- Playback controls: play/pause, mute toggle, timeline scrubbing, and current-frame preview while paused. Preview audio is on by default (the source video's sound is no longer muted); the mute toggle is independent of export, which always passes the audio track through when present.
- Current-frame detection probe for paused detection tuning before a full Re-detect
- Quick Find Objects controls: Sensitivity (Low / Balance / High), Object Size (Small / Medium / Large), and Detector (Edge / Motion / HSV / Area; Russian UI labels Edge as `Контур`). Small-object tuning is the High + Small combination.
- 15 visual effects: Contour, Cross, Frame, L-Frame, X-Frame, Grid, Particle, Dash, Scope, Win2K, Backdrop, Emojis, Heatmap, Voronoi, ConvexHull
- Visual styles grouped: the Connection card holds Line Style, Connection Rate, and Stroke Width (no separate Stroke Width card)
- Style controls separate Color and Text cards. Color includes an 18-color palette with bilingual hover names, a native color picker, and custom `#rrggbb` hex input. Text includes visibility, position, content, and font-size controls.
- Centroid dot visibility lives in the Detect tab with the detection-related controls.
- 4 detector modes (Edge, Motion, HSV, Area). HSV detection converts the frame to HSV color space, selects pixels near the target hue within tolerance, and builds contours from that color mask.
- Output frame rate: source, 30, or 60 FPS
- In-app confirmation before switching to 30 or 60 FPS because it starts a re-detect pass
- Output dimensions: always the source video's original width, height, and aspect ratio
- MP4 and WebM export through Mediabunny 1.49.0 with audio passthrough
- WebCodecs MP4 fallback can recover from browser codec reclaim by retrying as WebM
- Automatic video-codec selection
- Detection and export progress
- Detection and export cancellation
- Tooltips for Find Objects, Detector, Basic Effects, Connection, Blob Size, Detection, Color, and Text controls. The Export card intentionally has no tooltip.
- **User-friendly error messages** — differentiated for video, audio, codec, CDN, and memory failures
- **English / Russian interface** — language toggle in the panel footer and About dialog
- **About dialog** — built-in info panel covering capabilities, privacy, limitations, and links

## Export status

Mediabunny 1.49.0 integration is verified. Both MP4 and WebM export work
with and without audio. Source-size export, playback controls, current-frame
probe, and post-export playback recovery are covered by the current online test
scenarios. The native WebCodecs MP4 fallback also handles Chrome's
`Codec reclaimed due to inactivity` failure by retrying through the WebM
fallback.

## Modular architecture

The app uses a modular HTML/CSS/JS architecture:

- `index.html` (~660 lines) — DOM structure, CDN loading, OpenCV loader, modals
- `styles.css` (~698 lines) — design system extracted from inline styles
- `app.js` — core logic, UI, detection pipeline
- `effects.js` (~342 lines) — 15 visual effects
- `export.js` (~480 lines) — Mediabunny export + native fallbacks (MP4/WebM/audio)

## Export behavior

Export is not a pixel-for-pixel copy of the source. The app redraws the source
video and selected effects to a Canvas and re-encodes the result.

Loading or dropping a video does not start blob detection. It prepares the
preview and exposes detection/style controls. The first analysis starts only
when the user clicks `Start detection`; after a successful pass the same action
becomes `Re-detect`.

The user can select:

- source, 30, or 60 FPS;
- MP4 or WebM.

Switching from the source frame rate to 30 or 60 FPS opens an in-app
confirmation dialog. Confirming starts a full re-detect because the internal
frame grid changes.

The exported video always uses the loaded source video's original pixel
dimensions and aspect ratio. The online interface intentionally does not expose
separate output-size presets.

Exported files include synchronized audio when the source has an audio track.
If the legacy WebCodecs MP4 path fails because the browser reclaimed an inactive
encoder during a slow export, the app logs the error and retries as WebM so the
export can still complete.

## Runtime and privacy

The app has no video-processing backend. OpenCV.js and Mediabunny are loaded
from third-party CDNs, so the first load requires internet access. The local
video itself is not sent to those CDNs by the application.

## Development notes

When changing `styles.css`, `app.js`, `effects.js`, or `export.js`, update the matching `?v=...` query string in `index.html`. Browser cache can otherwise keep old JS/CSS active while newer HTML is visible.

**OpenCV.js reliability**: OpenCV.js loads from a 3-CDN fallback chain
(`docs.opencv.org` → `cdn.jsdelivr.net` → `unpkg.com`) with per-CDN download and
runtime-initialization timeouts. The loading screen shows the current attempt
(`CDN 1/3`), and if all CDNs fail, a user-facing error with a **Retry** button
replaces the spinner so the user is never stuck on an endless loader. Retry
re-runs the full chain. State is exposed via `window.__openCvStatus` and the
`onCvReady` / `onCvError` callbacks in `app.js`. Covered by
`tests/js/test-opencv-fallback.mjs` (3 scenarios: primary-blocked fallback,
all-blocked error UI, retry-after-unblock).

## Tests

- `tests/js/run-online-tests.mjs` — 7 end-to-end test scenarios (127 assertions locally)
- `tests/js/test-opencv-fallback.mjs` — OpenCV CDN fallback + retry coverage (3 scenarios, 24 assertions)

## License

Blob Tracker is MIT licensed; see `LICENSE`. Mediabunny is loaded from its
official package distribution under MPL-2.0.
