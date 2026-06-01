# Tracking Stabilization — Design

**Date:** 2026-06-01
**Status:** Approved (design), pending implementation
**Scope:** `index.html` — `CentroidTracker` class only

## Problem

On exported/preview video, overlays feel "dirty" and unstable. Even around a
**static** object, blobs constantly jiggle, flicker, and shift. Reported by the
user as: "blobs keep moving around even a stationary object."

Root causes (all originate in per-frame detection + track matching):

1. **Jitter** — `Canny` recomputes edges every frame on noisy/compressed video,
   so the centroid and bounding box are recomputed from scratch each frame and
   wobble even when nothing moves.
2. **Ghost blobs** — small false blobs appear for 1–2 frames and vanish,
   flickering around the real object.
3. **Track death on dropouts** — `CentroidTracker` overwrites `this.prev = blobs`
   every frame, so any object missing for even one frame loses its track and
   reappears with a new ID (and new per-ID color/label/trail).

## Decisions (from brainstorming)

- **Overlay shapes in scope:** Circle and BBox only. The user never uses the
  Contour shape, so live-contour temporal smoothing is explicitly **out of scope**.
- **Smoothing strength:** "Balanced" — jitter mostly removed, lag barely
  perceptible. Tunable via constants.
- **Behavior target:** all three of jitter-reduction, ghost-suppression, and
  dropout-tolerance.

## Approach (chosen: enhance `CentroidTracker`)

All changes live in the `CentroidTracker` class (currently `index.html` lines
938–954). The external interface is unchanged: `detectBlobs()` still calls
`tracker.update(cts)` and stores the result in `all_frame_data`. Rendering,
export, interpolation, scrubbing, crop, effects — untouched.

Rejected alternatives:
- **Post-process pass** over `all_frame_data` — duplicates matching logic, second
  full pass, two matching systems can conflict.
- **Smooth at render time** (`interpolateBlobs`/`drawLoop`) — breaks on
  scrub/seek (no "previous frame"), and cannot remove ghosts (already in data).

Because stabilized data is written into `all_frame_data`, the effect appears in
preview, MP4 export, and re-detect for free.

## Algorithm

The tracker stops being "stateless per previous frame" and maintains a list of
**live tracks**. Each track: `{ id, x, y, bw, bh, area, age, missed, visible }`.

Per frame, `update(blobs)`:

1. **Match** input blobs to live tracks via greedy nearest-neighbor within radius
   `maxD` (same matching metric as today).
2. **Matched** → update track with EMA smoothing:
   `x = x*(1−α) + measuredX*α` (same for `y`, `bw`, `bh`, `area`);
   `missed = 0`; `age++`.
3. **Unmatched input blob** → new candidate track: `age = 1`, `visible = false`,
   no `id` assigned yet.
4. **Unmatched track** (object disappeared this frame) → `missed++`. If
   `missed > MAX_MISSED`, delete the track. Otherwise keep it at its last
   smoothed position.
5. **Promotion** → when `age >= MIN_AGE`, set `visible = true` and assign a
   permanent `id` (`this.nextId++`).
6. **Return** only tracks with `visible === true` (including currently-blind ones
   where `missed > 0`, at their last smoothed position).

Returned blob shape stays exactly as today
(`{id, x, y, bw, bh, area, bx, by, pts}`) so the renderer notices nothing.
`bx, by` are derived from smoothed center + size: `bx = x − bw/2`, `by = y − bh/2`.
`pts` (contour points) are passed through from the matched detection; contour
shape is out of scope and not smoothed.

### Tunable constants (top of class — adjusted after watching real video)

```
SMOOTHING_ALPHA = 0.4   // balanced: lower = calmer / more inertia
MIN_AGE         = 2     // frames before a track is shown (suppresses ghosts)
MAX_MISSED      = 5     // frames a track survives "blind" before deletion
```

At `PROCESSING_FPS = 20`: `MIN_AGE = 2` ≈ 0.1 s appear-delay;
`MAX_MISSED = 5` ≈ 0.25 s disappear-grace.

## Expected behavior changes

- **New object appears** → overlay shows after ~0.1 s (no ghost flashes).
- **Object leaves frame** → overlay lingers ~0.25 s then disappears (no instant
  blink).
- **Fast motion** → overlay catches up with slight inertia; near-imperceptible at
  balanced level.
- **MP4 export and preview** → identical (stabilization is in the data).
- **Re-detect** → recomputes with stabilization.
- **Everything else** (colors, effects, lines, crop, text, centroid dots) →
  unchanged.

The number of blobs per frame becomes more stable; the trade-off is the ~0.1 s
appear-delay for genuinely new objects.

Note: the existing `pytest` suite covers the Python `v2`/Streamlit code, **not**
`index.html`. The browser app has no JS test framework. So the tracker logic is
verified with a small standalone Node script (the same tooling already used to
syntax-check `index.html`).

1. **Logic test (standalone Node script):** the `CentroidTracker` class is plain
   JS with no DOM dependency, so it can be exercised directly in Node with a
   scripted sequence of synthetic blob frames. Assertions:
   - a 1-frame ghost blob is never returned (not promoted past `MIN_AGE`);
   - an object that drops out for ≤ `MAX_MISSED` frames keeps the same `id`;
   - a static object's returned center stays within a small epsilon across frames
     (smoothing converges and holds);
   - a moved object's center tracks toward the new position over a few frames.
   The class is defined inline in `index.html`; the test script either imports it
   via a tiny extraction shim or pastes the class body — chosen at implementation
   time. No production code needs to move out of `index.html`.
2. **Visual confirmation (primary):** run the app, user plays their real video,
   reports "calm" / "still jittery" / "too laggy". Tune the 1–3 constants
   accordingly — no algorithm rewrite.

## Out of scope (YAGNI)

- Live-contour temporal smoothing.
- A user-facing "Stabilization" slider. Constants are isolated at the top of the
  class so a slider (the deferred "Approach C") can be grown later if the user
  wants per-video control after seeing results.
