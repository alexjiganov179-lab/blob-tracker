# blob_tracker — Work Plan

Historical improvement roadmap for the original single-file Canny-based contour overlay tool. The active implementation now lives in `online-version/` as modular HTML/CSS/JS.

> Current documentation lives in `README.md` and `online-version/README.md`. This file is retained as roadmap history and should not be read as the current product surface.

Status: Phases 1, 2, 3 complete. Phases 4-6 pending.

---

## Context

Current state of the app:

- Single-file `index.html` with all CSS + JS inline, no build step.
- 14 "Basic Effects" (hardcoded `if/else` chain in `drawEffectLayer`).
- WebGL2 GPU pipeline for blur + Sobel edge detection.
- WebCodecs MP4 export (currently **broken**: `ReferenceError: w is not defined`).
- OpenCV.js + mp4-muxer loaded from CDN.
- No real backend, no persistence beyond debug log in `localStorage`.
- README documents features that do not exist in code (14 filter effects, 1080×1920 Instagram export, MediaRecorder WebM, Trail, Crop 9:16, etc.).

Competitive landscape:

| Product | Differentiator |
|---|---|
| artkit.cc/baby-track | Pro presets, gallery, paid tier |
| effect.app/blob-tracker | 70+ effects, keyframe timeline, 4K, 5 min export |
| blobit.art | Node-based native wrapper for sale |
| mondniles.com/blob-tracker | Minimalist VJ aesthetic, free |
| nicholaspjm/web-blob-tracker | MIT, webcam input, single file |
| TouchDesigner / Notch / cables.gl | Pro real-time, node graph, OSC/MIDI/DMX |

Gap we can fill: **free, open-source blob tracker with a real effects plugin system and VJ-quality export**.

---

## Out of scope (explicitly excluded)

- Keyboard shortcuts for export / preset switching
- Mobile layout, media queries, touch-friendly sliders
- Mobile-specific performance optimizations
- Document Picture-in-Picture mode
- Multi-clip timeline
- Keyframe timeline (deferred to Phase 6)

---

## Dependency graph

```
Phase 1 (cleanup)         — blocks everything else
  └── Phase 2 (effects registry) — blocks Phase 3
        ├── Phase 3 (trails, audio, export)
        ├── Phase 4 (input, presets)        — independent of Phase 3
        └── Phase 5 (perf + polish)         — independent of Phases 3 and 4
                  └── Phase 6 (pro features) — on demand
```

Phases 3, 4, and 5 can ship as parallel branches after Phase 2 lands.

---

## Phase 1 — Cleanup & correctness

**Effort:** 0.5–1 day. **One PR.**

Goal: remove bugs and dead code, align docs with reality.

| # | Task | File / line | Size |
|---|---|---|---|
| 1.1 | Fix export `ReferenceError: w is not defined` -> use `ew/eh` | `index.html:1834-1835` | XS |
| 1.2 | Remove dead code: `let activePreset`, `let detectionParamsSnapshot`, `P.useConvexHull`, `P.sameSize`, `GPU.programDilate` + `FRAG_DILATE`, `#export-format` CSS | `index.html:488, 866, 887, 1113, 1078, 520, 54-58` | XS |
| 1.3 | English-only UI text: strip Russian from `alert()`, toast, console warnings, `file://` notice | `index.html:1211, 1217, 1245, 1298, 1950-1958` | XS |
| 1.4 | Update README to match actual code: drop false claims about 14 filter effects, 1080×1920 Instagram export, MediaRecorder WebM, Trail, Crop 9:16, Region Style, Shape modes, crazy mode. Document only what actually works. | `README.md:12, 34, 48-60` | S |
| 1.5 | Cancel-detection button `#cancel-detect` in progress bar; abort `detectBlobs` via `AbortController` or `cancelRequested` flag | `index.html:1500-1528` | S |
| 1.6 | Cancel-export button `#cancel-export`; abort the export loop in `startExportMP4` via the same flag | `index.html:1769-1890` | S |

**Acceptance:**

- Export no longer throws on the first frame.
- No unused variables, no orphan CSS, no orphan shader programs.
- README accurately describes the shipped app.
- Both Cancel buttons interrupt their long-running operations.

---

## Phase 2 — Pluggable effects foundation

**Effort:** 1–2 days. **One PR.**

Goal: move effects into a registry so every later feature (Trail, Audio, particle-per-blob-state) can plug in.

| # | Task | File / line | Size |
|---|---|---|---|
| 2.1 | Define `EFFECTS = [{id, label, group, draw(ctx, blobs, P)}]`. Replace the `if/else` chain in `drawEffectLayer` with a registry lookup. | `index.html:1574-1672` | M |
| 2.2 | Convert all 14 existing effects to registry entries (zero behavior change). | same block | M |
| 2.3 | Move Particle state to a `Map<blobId, ParticleState>` so positions persist across frames (fixes "boil"). | `index.html:1627-1628` | S |
| 2.4 | Tooltip on touch: replace `touchstart` 3 s timer with `pointerdown` 500 ms long-press. | `index.html:1937-1941` | XS |

**Acceptance:**

- New effects can be added in one line.
- Particle no longer re-randomizes per frame.
- Touch tooltip triggers on long-press.

---

## Phase 3 — Motion-blur / trails + export

**Effort:** 3–5 days. **One or two PRs.** **Status: done.**

Goal: multi-resolution, multi-codec export.

| # | Task | File / line | Size | Status |
|---|---|---|---|---|
| 3.1 | ~~Motion-blur / trails: ring buffer of the last N canvas frames; new `Trail` registry effect composites copies with decaying opacity.~~ **Dropped** — removed in favor of cleaner effect surface; the trail buffer composited whole frames (including video) instead of blob layers. | — | M | dropped |
| 3.3 | WebM export via `MediaRecorder` as fallback for Firefox / Safari (no WebCodecs). | `index.html:1769-1890` (parallel path) | M | done |
| 3.4 | Full-res export path: flag `outputSize = 'preview' | '1080p' | '1080x1920'`; render into `exportCanvas` at the requested size. | `index.html:1780-1850` | M | done |
| 3.5 | `VideoEncoder.isConfigSupported` probe + codec `avc1.640028` (High Profile) for Instagram, `avc1.42001f` (Baseline) for preview. | `index.html:1810-1814` | S | done |
| 3.6 | `fastStart: 'in-memory'` in muxer (or post-process via mp4box) for web-streamable output. | `index.html:1794` | S | done |

**Acceptance:**

- MP4 export works in Chrome/Edge, WebM in Firefox/Safari. ✓ (H.264 path uses WebCodecs + `mp4-muxer`; WebM path uses `MediaRecorder` on `captureStream(0)` + `track.requestFrame()` for frame-by-frame control.)
- 1080×1920 Instagram export produces a valid H.264 High Profile file. ✓ (`VideoEncoder.isConfigSupported` tries `avc1.640028` first for non-preview sizes, falls back to Baseline.)

---

## Phase 4 — Input sources & persistence

**Status: SKIPPED** (2026-06-07). Phase 4 features (webcam, MIDI, IndexedDB presets, URL share, debug-mask preview) are out of scope for the VJ-contour workflow. Phase 3 already covers the must-haves. Revisit only on explicit product demand.

**Effort:** 2–4 days. **One or two PRs.**

Goal: webcam, live mode, real preset workflow.

| # | Task | File / line | Size |
|---|---|---|---|
| 4.1 | Webcam input: `navigator.mediaDevices.getUserMedia({video: true})` -> same `<video>` element. "Use camera" button next to Upload. | new `WebcamSource` | M |
| 4.2 | Live mode (no video file): toggle disables export, switches to continuous detection + render loop. | flag in `drawLoop` | S |
| 4.3 | Save / load presets in IndexedDB. "Save preset" / "Load preset" buttons in Find Objects card. Use the extended schema from `presets.json`. | new `PresetStore` + UI | M |
| 4.4 | URL share: base64-JSON encode `P`, query `?p=...`, restore on load. | new `URLState` | S |
| 4.5 | Wire up `presets.json`: dropdown in UI (Neon Debug, Minimal White, Bounding Boxes, Blob Fill, Glitch, Grouped Branches); extended schema is spread into `P`. | `presets.json` (currently unused, `index.html:1953-1954`) | S |
| 4.6 | Detection-mask preview toggle (matches effect.app "debug mask"): show raw edge map instead of video. | new render mode | S |
| 4.7 | MIDI input via WebMIDI API: CC -> `P` parameters; mapping table in localStorage. | new `MIDIBridge` | L |

**Acceptance:**

- Webcam is a usable source.
- Presets persist, load, and share via URL.
- `presets.json` is no longer dead weight.
- MIDI controller knobs modulate parameters.

---

## Phase 5 — Performance & polish

**Effort:** 2–3 days. **Multiple small PRs (1-2 tasks each).**

Goal: stop wasting CPU and clean up the rough edges.

| # | Task | File / line | Size |
|---|---|---|---|
| 5.1 | Replace `JSON.parse(JSON.stringify(blobs))` with `structuredClone(blobs)` (faster, handles non-JSON types). | `index.html:1515` | XS |
| 5.2 | Skip render when paused: `if (video.paused && !liveMode) return;` at top of `drawLoop`. | `index.html:1741-1755` | XS |
| 5.3 | Remove `willReadFrequently: true` from `tempCtx` (read once via `cv.imread`, not in a hot loop). | `index.html:808` | XS |
| 5.4 | FPS + blob-count telemetry overlay: current FPS, average / peak blob count, drop %. | new `Telemetry` overlay | S |
| 5.5 | Sliders: min/max labels + per-control reset button (⟲). | `setupSlider` at `index.html:961-972` | S |
| 5.6 | Undo/redo for parameter changes: ring buffer of `P` snapshots on Ctrl+Z / Ctrl+Shift+Z. (No other keyboard shortcuts.) | new `History` + listener | M |
| 5.7 | Fullscreen preview via Fullscreen API on double-click of canvas. | new `Fullscreen` module | S |
| 5.8 | Particle per-blob lifetime: particles fly out and fade, not re-randomize. | `index.html:1627-1628` (after 2.3) | S |
| 5.9 | Wire `GPU.programDilate` into `gpuCanny` (replaces CPU `cv.dilate`). | `index.html:520, 738-754, 1332` | M |
| 5.10 | WebGPU compute spike: prototype `findContours` in a compute shader -> eliminates the `gl.readPixels` bottleneck. Ship as a separate research PR, not a blocker. | new spike file | XL |

**Acceptance:**

- `drawLoop` does not burn CPU on pause.
- FPS and blob count are visible at a glance.
- Undo reverts parameter changes.
- Particle flies out realistically.
- WebGPU spike is a separate experimental PR.

---

## Phase 6 — Pro features (on demand)

| # | Task | Why |
|---|---|---|
| 6.1 | Frame-accurate keyframe timeline (1 track, 5 parameters, easing curves) | Monetization track à la effect.app $20/mo |
| 6.2 | OSC input via WebSocket bridge | Pro VJ scenario |
| 6.3 | WebGPU `findContours` (if spike in 5.10 is viable) | Full replacement of OpenCV.js |
| 6.4 | Multi-clip timeline | NLE category pivot |

---

## Recommended ship order

1. Phase 1 — single PR, green baseline.
2. Phase 2 — single PR, foundation for everything else.
3. Phase 3 and ~~Phase 4 (skipped)~~ — only Phase 3 shipped.
4. Phase 5 — small, frequent PRs.
5. Phase 6 — separate sprint once demand is confirmed.
