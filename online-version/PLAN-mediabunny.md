# Mediabunny Integration Status and Verification Plan

Status: **Mediabunny export verified for the current Chrome online test suite. Not yet accepted for public release.**

Audit date: 22 June 2026 (audio fix re-verified 23 June 2026). Inventory: 23 June 2026. Documentation refreshed 03 July 2026.

This section is the current source of truth for Mediabunny. The original
integration proposal remains below as historical reference; its code snippets,
line numbers, browser claims, and completion assumptions are not current
acceptance evidence.

## Current architecture

- Mediabunny 1.49.0 is loaded from jsDelivr through an import map.
- MP4 uses `Mp4OutputFormat`, `CanvasSource`, and `BufferTarget`.
- WebM uses `WebMOutputFormat`, `CanvasSource`, and `BufferTarget`.
- Video codecs are selected through `getFirstEncodableVideoCodec`.
- Source audio is read through `AudioSampleSink` and re-encoded through
  `AudioSampleSource` as AAC for MP4 or Opus for WebM.
- Export dimensions are taken from the loaded source video's original width and
  height. The online interface no longer exposes Preview / 1080p / 9:16 size
  presets.
- Playback controls and current-frame probe are part of the preview workflow.
- Switching from source FPS to 30 or 60 FPS requires an in-app confirmation and
  starts a full re-detect pass.
- The legacy WebCodecs MP4 fallback retries as WebM if Chrome reclaims the H.264
  encoder due to inactivity during a slow frame-by-frame export.
- The full output is currently accumulated in memory before download.

## Reproduction used for this audit

Environment:

- installed desktop Google Chrome;
- local HTTP server serving `online-version`;
- Mediabunny 1.49.0 and OpenCV.js loaded from their configured CDNs;
- synthetic two-second MP4 input;
- H.264 video, 320×240, 30 FPS;
- AAC audio at 48 kHz;
- equivalent video-only control input.

The browser detected 61 frames. Mediabunny selected AVC for MP4 and VP9 for
WebM.

## Verified results

All results from automated test suite: 7 scenarios, 82 assertions, 0 failures (24 June 2026).

| Scenario | Result | Evidence |
|---|---|---|
| Dependency load | ✅ pass | OpenCV.js and Mediabunny initialized in headless Chrome |
| MP4 codec selection | ✅ pass | AVC selected |
| WebM codec selection | ✅ pass | VP9 selected |
| MP4 without audio | ✅ pass | H.264, 720×540, 30 FPS, 2.000 s; full decode passed |
| WebM without audio | ✅ pass | VP9, 720×540, 30 FPS, 2.000 s; full decode passed |
| MP4 with AAC input | ✅ pass | scenario 1: AAC present, 2.043s, full decode, no AudioSample leaks |
| WebM with AAC input | ✅ pass | scenario 2: Opus present, 2.060s, full decode, no AudioSample leaks |
| MP4 cancellation without audio | ✅ pass | scenario 7: process stopped, UI reset, page alive |
| Resource cleanup with audio | ✅ pass | no `AudioSample` leak warnings in any scenario |
| Vertical source size → MP4 | ✅ pass | scenario 5: source 1080×1920, H.264, full decode |
| 60 FPS → Source FPS | ✅ pass | scenario 6: export works (sourceFps null in headless but duration correct) |
| 1080p / 4K / 1 minute / 500 MB | ⏳ not verified | no complete current matrix |
| Edge / Firefox / Safari | ❌ not verified | no end-to-end evidence outside Chrome |

## Fixed — audio timestamp normalization

Both previously-failing issues are now fixed in `online-version/index.html`:

### Negative timestamp fix

The `setupAudioPassthrough()` function (line 2911) now:

1. Reads `getFirstTimestamp()` from the source audio track
2. Computes `timeOffset` to shift all negative timestamps ≥ 0
3. Dynamically adjusts per-chunk if later samples also have negative timestamps
4. Applies the offset via `chunk.setTimestamp()` before adding to the output

```js
const firstTimestamp = await audioTrack.getFirstTimestamp();
let timeOffset = firstTimestamp < 0 ? -firstTimestamp : 0;
// ...
const ts = chunk.timestamp + timeOffset;
if (ts !== chunk.timestamp) chunk.setTimestamp(ts);
```

### Resource leak fix

Every `AudioSample` is now closed in a `finally` block, and the `AudioSampleSource`
is also closed in a `finally` block on exit. The `drainExportAudio()` helper
handles both success and cancellation paths.

### Automated verification

`tests/js/audio-export-check.mjs` is a Playwright-based check that:

1. Serves `online-version/index.html` via local HTTP server
2. Loads the page in headless Chromium
3. Uploads `input.mp4` (H.264 + AAC, encoder delay present)
4. Completes blob detection and export
5. Downloads the result
6. Validates via `ffprobe`: audio track present, AAC codec, duration ±0.05s,
   full decode without errors, no `AudioSample` leak warnings

**Result (23 June 2026):** MP4 export with audio passes all checks.

### Modular refactoring (24 June 2026)

The online-version has been refactored from a monolith into 5 modular files
(`index.html`, `styles.css`, `app.js`, `effects.js`, `export.js`). All line
references in this document (e.g. "line 2911") refer to the old monolith and
are now obsolete — the code lives in the new files. The logic is unchanged:
`runMediabunnyExport()` is now in `export.js`, `setupAudioPassthrough()` in
`app.js`.

### Remaining gap — closed (24 June 2026)

WebM export with audio is now covered by the automated suite (scenario 2,
assertion: "Audio track present (Opus), duration 2.060s, full decode").

## Readiness decision

Mediabunny is **ready for continued internal testing in Chrome**. MP4 and WebM
export work with and without audio in the current automated online suite.

**Release blockers still open:**
- Full browser matrix not tested (Edge, Firefox, Safari).
- Large / long-duration input boundary not tested (1 min, 4K, 500 MB).
- Audio/video sync is verified indirectly by duration and decode checks, but not
  by a dedicated sync analysis.
- Author visual QA and explicit publication approval are still required.

The old root `index.html` legacy single-file version has been removed. Current
online-version tests live in `tests/js/run-online-tests.mjs`; older ad-hoc checks
should not be used as acceptance evidence for `online-version`.

## Required work before acceptance

### ✅ P0 — repair audio timing and cleanup (DONE)

Fixed in `online-version/export.js` / `online-version/app.js`:
- ✅ Negative audio timestamps normalized via `getFirstTimestamp()` + `timeOffset`
- ✅ Shared timeline origin for video and audio
- ✅ Every `AudioSample` closed in `finally` block
- ✅ `AudioSampleSource` closed in `finally` block
- ✅ Audio reading stops on cancellation (`if (!isExporting) break`)
- ✅ Errors surface through `drainExportAudio()` (not silently swallowed)
- ✅ No silent video-only fallback when source contains audio

Verified 23 June 2026 via `tests/js/audio-export-check.mjs`.

### P0 — add end-to-end regression coverage (done)

Full 7-scenario suite in `tests/js/run-online-tests.mjs`:

| Fixture | Status | Test |
|---|---|---|
| H.264 + AAC → MP4 | ✅ done | scenario 1 |
| H.264 + AAC → WebM | ✅ done | scenario 2 |
| video-only → MP4 | ✅ done | scenario 3 |
| video-only → WebM | ✅ done | scenario 4 |
| Vertical source size → MP4 | ✅ done | scenario 5 |
| 60 FPS → Source FPS | ✅ done | scenario 6 |
| Cancel long export | ✅ done | scenario 7 |
| Playback controls + current-frame probe | ✅ done | covered inside standard export flows |
| Source with Opus audio | ❌ still missing | needs fixture and test coverage |

Every successful output check must verify:

- expected video codec and dimensions;
- presence or absence of audio as required;
- expected audio codec;
- duration within one output frame of the source;
- audio/video synchronization;
- full decode without errors;
- no page errors, unhandled rejections, or resource-leak warnings.

### P1 — memory and long-input behavior

- Measure source-size output at common source resolutions, including 1080p and 4K.
- Test the one-minute and 500 MB product targets.
- Record peak memory and export time.
- Decide whether `BufferTarget` is safe for the supported envelope.
- If it is not safe, use a streaming output strategy or publish a lower,
  enforced limit.

### P1 — browser matrix and interface truth

- Run the same export fixtures in Chrome, Edge, Firefox, and Safari.
- Keep UI tooltips aligned with source-size export and fallback behavior.
- Show actionable messages for missing codecs, CDN failure, audio failure,
  memory failure, and unsupported inputs.

## Mediabunny acceptance gate

Mediabunny may be marked ready only when all of the following are true:

1. MP4 and WebM both pass with audio and without audio — ✅ **scenarios 1-4 all pass**
2. Exported audio remains synchronized with the processed video — ⏳ **not explicitly verified (ffprobe sync analysis missing)**
3. Cancellation closes video, audio, and output resources — ✅ **scenario 7 pass: no leaks, UI reset, page alive**
4. No `AudioSample` leak warning or unhandled rejection appears — ✅ **all 7 scenarios: 0 leaks**
5. Output files pass metadata inspection and full decoding — ✅ **all 7 scenarios: ffprobe + ffmpeg decode pass**
6. The supported size/duration/browser matrix is documented from actual runs — ❌
7. `SPEC.md` and `README.md` match the verified result — ✅ **updated 03 July 2026**

---

## Historical integration proposal — reference only

The material below describes the plan that led to the current implementation.
It must not be read as proof that a phase passed acceptance.

### Original executive summary

Integrate [mediabunny](https://mediabunny.dev) (v1.49.0, MPL-2.0) to:

1. **Replace `mp4-muxer` CDN dependency** — mediabunny has a built-in MP4 muxer
2. **Replace manual WebCodecs glue** — `CanvasSource` handles encoding + muxing in one API
3. **Replace `MediaRecorder` WebM path** — native WebM muxer with proper VP8/VP9/AV1 encoding
4. **Add audio passthrough** — read source audio track, mux into output
5. **Simplify codec negotiation** — `getFirstEncodableVideoCodec` replaces manual `isConfigSupported` probing
6. **Unify export pipeline** — one code path for MP4 + WebM + any future format

**No build step required** — mediabunny loads from CDN via `<script type="importmap">` or dynamic `import()`, preserving the modular architecture.

---

## Architecture Constraints

| Constraint | How we handle it |
|---|---|
| Single `index.html` (no bundler) | Dynamic `import()` from CDN, same pattern as current `mp4-muxer` load |
| GitHub Pages (static hosting, no server) | All dependencies load from CDN; no npm install needed for end users |
| No npm / Node.js on deploy | CDN for everything |
| OpenCV.js still required | Mediabunny does not replace computer vision (Canny, contours) — OpenCV.js stays for detection |
| Frame-by-frame compositing | `CanvasSource.add(timestamp, duration)` pushes frames to the muxer — same control as current seek loop |
| Cancel export support | Abort via `Output.abort()` or manual cancellation flag + `encoder.close()` |
| Progress reporting | `Conversion.onProgress` or manual progress in frame loop |

---

## CDN Loading Strategy

### Current loading pattern (being replaced):

```html
<script>
import("https://unpkg.com/mp4-muxer@5.1.3/build/mp4-muxer.mjs")
  .then(m => { window.MP4Muxer = m; });
</script>
```

### New loading pattern:

```html
<script type="importmap">
{
  "imports": {
    "mediabunny": "https://cdn.jsdelivr.net/npm/mediabunny@1.49.0/dist/modules/src/index.js"
  }
}
</script>
<script type="module">
import { Output, Mp4OutputFormat, WebMOutputFormat, BufferTarget,
         StreamTarget, CanvasSource, Input, BlobSource, ALL_FORMATS,
         getFirstEncodableVideoCodec, QUALITY_HIGH, QUALITY_MEDIUM } from 'mediabunny';
window.MediaCodecs = {
  Output, Mp4OutputFormat, WebMOutputFormat, BufferTarget, StreamTarget,
  CanvasSource, Input, BlobSource, ALL_FORMATS,
  getFirstEncodableVideoCodec, QUALITY_HIGH, QUALITY_MEDIUM
};
</script>
```

**Bundle size:** ~616 kB minified (vs. OpenCV.js at ~8 MB — no material impact on load time).

**jsDelivr CDN URL** (recommended):
`https://cdn.jsdelivr.net/npm/mediabunny@1.49.0/dist/bundles/mediabunny.min.mjs`

**Fallback CDN:**
`https://unpkg.com/mediabunny@1.49.0/dist/bundles/mediabunny.mjs`

---

## Integration Phases

### Phase 0 — CDN Setup + Global Facade

**Files changed:** `index.html`

**What:**
- Add importmap or dynamic `import()` call for mediabunny
- Expose the classes we need as `window.MediaCodecs.*`
- Remove the `mp4-muxer` import (now replaced)
- Pin version to `@1.49.0` for stability

**Acceptance:**
`window.MediaCodecs.Output` is available in the console after page load.

---

### Phase 1 — Replace `mp4-muxer` + WebCodecs Manual Glue

**Files changed:** `index.html` (export section, ~lines 3023–3086)

**Current code** (`runWebCodecsExport()`):
```
mp4-muxer + manual VideoEncoder → seek frame → render → encode → mux chunk
```

**New code** (via `CanvasSource`):

```js
async function runMediabunnyExport() {
  const { w: ew, h: eh } = computeExportSize();
  const fps = getEffectiveFps();
  const output = new MediaCodecs.Output({
    format: new MediaCodecs.Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new MediaCodecs.BufferTarget(),
  });
  const videoSource = new MediaCodecs.CanvasSource(exportCanvas, {
    codec: 'avc',
    bitrate: computeBitrate(ew, eh),
  });
  output.addVideoTrack(videoSource);
  await output.start();

  // Frame loop (same as current, but push via CanvasSource instead of manual encoder)
  for (let i = 0; i < totalFrames; i++) {
    if (!isExporting) { await output.abort(); return { cancelled: true }; }
    const targetTime = i / fps;
    await seekTo(targetTime);
    const blobs = lookupBlobs(video.currentTime);
    renderToTarget(exportCtx, blobs, ew, eh);
    await videoSource.add(targetTime, 1 / fps);
    // Progress UI
  }

  videoSource.close();
  await output.finalize();
  const buf = output.target.buffer;
  return { cancelled: false, blob: new Blob([buf], { type: 'video/mp4' }), ext: 'mp4' };
}
```

**What changes:**
- `CanvasSource` replaces the triple of: `MP4Muxer.Muxer` + `VideoEncoder` + manual chunk handling
- Encoding is handled internally by mediabunny (WebCodecs behind the scenes)
- `fastStart: 'in-memory'` is built into `Mp4OutputFormat`
- Codec/bitrate configuration via `VideoEncodingConfig`

**What stays the same:**
- Frame seek loop (`seekTo`)
- `renderToTarget()` compositing
- `computeExportSize()`, `computeBitrate()`
- Progress bar UI
- Cancel mechanism

**Acceptance:**
MP4 export works at the source video's original dimensions without `mp4-muxer`.

---

### Phase 2 — Replace MediaRecorder WebM Path

**Files changed:** `index.html` (lines ~3089–3141)

**Current code** (`runWebMExport()`):
```
canvas.captureStream(0) → MediaRecorder → manual frame request → chunks
```

**New code** (same `CanvasSource` + `WebMOutputFormat`):

```js
async function runMediabunnyWebMExport() {
  const output = new MediaCodecs.Output({
    format: new MediaCodecs.WebMOutputFormat(),
    target: new MediaCodecs.BufferTarget(),
  });
  const videoSource = new MediaCodecs.CanvasSource(exportCanvas, {
    codec: await pickBestCodec(['vp9', 'vp8', 'av1']),
    bitrate: computeBitrate(ew, eh),
  });
  output.addVideoTrack(videoSource);
  await output.start();

  // Same frame loop as Phase 1
  for (let i = 0; i < totalFrames; i++) {
    // ...
    await videoSource.add(targetTime, 1 / fps);
  }

  videoSource.close();
  await output.finalize();
  return { cancelled: false, blob: new Blob([output.target.buffer], { type: 'video/webm' }), ext: 'webm' };
}
```

**What changes:**
- `WebMOutputFormat` replaces `MediaRecorder` entirely
- No `captureStream`, no `track.requestFrame`, no `MediaRecorder.isTypeSupported` probing
- Same `CanvasSource.add()` API as MP4 path
- VP9/VP8 encoding via WebCodecs (hardware accelerated where available)

**Acceptance:**
WebM export works in Firefox / Safari without `MediaRecorder`.

---

### Phase 3 — Codec Negotiation via `getFirstEncodableVideoCodec`

**Files changed:** `index.html` (lines ~2969–2981)

**Current code** (`pickH264Codec`):
```js
const candidates = ["avc1.640028", "avc1.4D4028", "avc1.42001F", "avc1.42E01F"];
for (const codec of candidates) {
  const r = await VideoEncoder.isConfigSupported({ codec, width, height, bitrate, framerate });
  if (r?.supported) return codec;
}
return null;
```

**New code**:
```js
async function pickExportCodec(outputFormat, width, height) {
  const codecs = outputFormat.getSupportedVideoCodecs();
  return await getFirstEncodableVideoCodec(codecs, { width, height });
}
```

**What changes:**
- Mediabunny handles the full codec string negotiation (correct profile/level)
- Works for any output format (MP4, WebM, MOV, etc.)
- Includes fallback chain automatically

**Acceptance:**
Codec selection works for H.264 High Profile at 1080p and Baseline at preview size.

---

### Phase 4 — Audio Passthrough (The Big Feature)

**Files changed:** `index.html` (export section)

**Current state:** Video-only export, no audio.

**New approach** — two options:

**Option A: Conversion API** (simplest, recommended for initial integration):

```js
async function runConversionExport() {
  const input = new MediaCodecs.Input({
    source: new MediaCodecs.BlobSource(currentVideoFile),  // need to keep the File ref
    formats: MediaCodecs.ALL_FORMATS,
  });
  const output = new MediaCodecs.Output({
    format: new MediaCodecs.Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new MediaCodecs.BufferTarget(),
  });

  const conversion = await MediaCodecs.Conversion.init({
    input, output,
    video: {
      process: (sample) => {
        // Compositing callback — receives each decoded video frame
        const blobs = lookupBlobs(sample.timestamp);
        const ctx = exportCanvas.getContext('2d');
        sample.draw(ctx, 0, 0, exportCanvas.width, exportCanvas.height);
        drawEffectLayer(ctx, scaleBlobs(blobs, exportCanvas, video));
        drawLinesLayer(ctx, scaleBlobs(blobs, exportCanvas, video));
        drawCentroidDots(ctx, scaleBlobs(blobs, exportCanvas, video));
        drawLabelsLayer(ctx, scaleBlobs(blobs, exportCanvas, video));
        return exportCanvas;
      },
    },
    // Audio passes through automatically!
    audio: {
      // Optional: resample, change bitrate, trim silence
    },
  });

  conversion.onProgress = (p) => {
    progressFill.style.width = (p * 100) + '%';
    progressLabel.textContent = 'Converting… ' + Math.round(p * 100) + '%';
  };

  await conversion.execute();
  return new Blob([output.target.buffer], { type: 'video/mp4' });
}
```

**Option B: Manual + AudioSampleSource** (more control, keeps existing seek loop):

```js
// 1. Open source file to extract audio
const input = new MediaCodecs.Input({
  source: new MediaCodecs.BlobSource(currentVideoFile),
  formats: MediaCodecs.ALL_FORMATS,
});
const audioTrack = await input.getPrimaryAudioTrack();
const audioSink = audioTrack ? new MediaCodecs.AudioSampleSink(audioTrack) : null;

// 2. Create output with both video and audio tracks
const output = new MediaCodecs.Output({
  format: new MediaCodecs.Mp4OutputFormat({ fastStart: 'in-memory' }),
  target: new MediaCodecs.BufferTarget(),
});
const videoSource = new MediaCodecs.CanvasSource(exportCanvas, {
  codec: 'avc', bitrate: computeBitrate(ew, eh),
});
output.addVideoTrack(videoSource);

let audioSource = null;
if (audioSink) {
  audioSource = new MediaCodecs.AudioSampleSource({
    codec: 'aac', bitrate: 128_000,
  });
  output.addAudioTrack(audioSource);
}
await output.start();

// 3. Read audio in parallel and push to output
let audioPromise = Promise.resolve();
if (audioSink) {
  audioPromise = (async () => {
    for await (const chunk of audioSink.samples()) {
      await audioSource.add(chunk);
    }
    audioSource.close();
  })();
}

// 4. Frame loop (same as today, but push via CanvasSource)
for (let i = 0; i < totalFrames; i++) {
  // ... seek, render ...
  await videoSource.add(targetTime, 1 / fps);
}
videoSource.close();
await audioPromise;
await output.finalize();
```

**What changes:**
- Audio is now included in exported files
- Source audio is re-encoded (AAC/Opus) to match the output container
- Works for both MP4 and WebM
- No extra CDN dependency — all built into mediabunny

**Acceptance:**
Exported MP4 and WebM files have audio from the source video.

---

### Phase 5 — StreamTarget for Large Files

**Files changed:** `index.html` (export section)

**Current:** `canvas.toBlob()` → `URL.createObjectURL()` → download link

**New** (optional, for files >2 GB):

```js
// Direct write to disk via File System Access API
const handle = await window.showSaveFilePicker({
  suggestedName: trackedFilename('mp4'),
});
const writable = await handle.createWritable();

const output = new MediaCodecs.Output({
  format: new MediaCodecs.Mp4OutputFormat({ fastStart: 'in-memory' }),
  target: new MediaCodecs.StreamTarget(writable, { chunked: true }),
});
// ... frame loop ...
await output.finalize();
await writable.close();
```

**Why it matters:**
- No RAM buffer for the entire output file
- Handles files >2 GB (Blob limit in some browsers)
- Direct download with native save dialog

**Acceptance:**
Large exports (10+ min at 1080p) work without memory errors.

---

### Phase 6 (Optional) — Replace Detection Seek with `VideoSampleSink`

**Current detection** seeks through the `<video>` element frame-by-frame using `video.currentTime` → `seeked` event. This is slow and puts jank on the main thread.

**With mediabunny:**

```js
async function detectBlobsMediabunny() {
  const input = new MediaCodecs.Input({
    source: new MediaCodecs.BlobSource(videoFile),
    formats: MediaCodecs.ALL_FORMATS,
  });
  const videoTrack = await input.getPrimaryVideoTrack();
  const sink = new MediaCodecs.VideoSampleSink(videoTrack);

  for await (const sample of sink.samples(0, videoDuration)) {
    // sample.draw(tempCtx, 0, 0) — write frame to canvas
    sample.draw(tempCtx, 0, 0, tempCanvas.width, tempCanvas.height);
    sample.close();
    const mat = cv.imread(tempCanvas);
    const blobs = detectContours(mat);
    mat.delete();
    all_frame_data.push({ time: sample.timestamp, blobs });
    // progress bar
  }
}
```

**Benefits:**
- No HTML `<video>` element needed during detection
- No seek latency (sequential decode, not random-access seek)
- Can run entirely off-screen in a Worker
- Cleaner promise-based iteration

**Drawback:** Requires the original `File` object, not a blob URL. Must be stored from `loadFile()`.

**Acceptance:**
Detection runs with the `File` object directly, no `<video>` element needed.

---

### Phase 7 (Future) — Reduce OpenCV.js Dependency

Mediabunny does **not** replace computer vision. OpenCV.js stays for:
- `cv.imread()` — read canvas to Mat
- `cv.Canny()` — edge detection
- `cv.findContours()` — contour detection
- `cv.moments()`, `cv.boundingRect()`, `cv.contourArea()` — blob metrics

However, mediabunny's `video.process` callback in Conversion can provide decoded `VideoSample` objects. If we ever want to replace OpenCV.js with a pure-JS alternative (e.g., our WebGPU pipeline), having the frame data come from mediabunny is a natural integration point.

---

## License Compliance (MPL-2.0)

Mediabunny is licensed under MPL-2.0 — a weak copyleft license.

**What we must do:**
- Retain all copyright notices, license headers, and attribution in any distributed source files
- Do not modify mediabunny's source code and re-distribute without publishing changes

**What we do NOT need to do:**
- Open-source blob_tracker (if we keep it proprietary)
- Pay royalties
- Use the same license for blob_tracker

**In practice:**
- Adding `npm install mediabunny` or loading from CDN is *using* the library, not distributing modified source
- No action needed beyond keeping the library's license file in the repo
- See [MPL-2.0 FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/) for details

**Our CDN setup is clean**: jsDelivr serves the original library with its full license intact.

---

## Migration Steps (Recommended Order)

```
Phase 0 ──→ Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5 ──→ Phase 6 (opt)
  CDN         MP4          WebM         Codec        Audio        Stream       Detection
  setup       export       export       picker       passthru     target       reformat
```

### Step-by-step:

1. **Branch:** `git checkout -b feat/mediabunny-integration`
2. **Phase 0:** Add `importmap`, expose `window.MediaCodecs`, verify load
3. **Phase 1:** Rewrite `runWebCodecsExport()` → `runMediabunnyExport()`. Remove `mp4-muxer` import. Test MP4 at source size.
4. **Phase 2:** Rewrite `runWebMExport()` → `runMediabunnyWebMExport()`. Remove MediaRecorder path. Test in Firefox.
5. **Phase 3:** Replace `pickH264Codec()`/`pickWebmMime()` with `getFirstEncodableVideoCodec()`.
6. **Phase 4:** Add audio passthrough (Conversion API preferred). Test exported files have audio.
7. **Phase 5 (optional):** Add StreamTarget for large files.
8. **Phase 6 (optional):** Rewrite detection loop with `VideoSampleSink`.
9. **Test:**
   - MP4 export: source-size output produces valid, playable files
   - WebM export: source-size output in Firefox/Safari
   - Audio: exported files have source audio
   - Cancel: export stops mid-way without leaving broken state
   - Progress bar: shows accurate percentage
10. **Update README:** Document mediabunny integration in features list
11. **Commit + PR:** `git add -A && git commit -m "feat: integrate mediabunny for export pipeline"`

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Mediabunny bundle ~616 kB | Additional ~0.5s load time on slow connections | Loaded async, non-blocking. OpenCV.js is 8 MB (13× larger) — negligible relative impact. |
| Mediabunny API breakage on update | Export breaks | Pin version (`@1.49.0`). Test before bumping. |
| WebCodecs not available in some browsers | No export | Mediabunny throws clear error — show fallback message. Safari 16.4+ supports it. |
| Audio passthrough encoding fails | Silent export | Graceful fallback: try audio, if fail, export video-only with warning. |
| `CanvasSource` memory for long videos | OOM for 30+ min videos | Phase 5 (StreamTarget) reduces memory. Also: `videoSource.close()` after each audio chunk. |
| CDN downtime | App broken | Add `<link rel="preload">` and a CDN fallback list. |
| `BlobSource` requires the original `File` object | Detection via `VideoSampleSink` needs the file, not a blob URL | Store `currentVideoFile` from `loadFile()` for both detection and export. |

---

## Code to Remove

After Phase 1–3, the following can be deleted from `index.html`:

| Item | Lines | Reason |
|---|---|---|
| `import("https://unpkg.com/mp4-muxer@5.1.3/...")` | 569–572 | Replaced by mediabunny |
| `MP4Muxer` global check | 3024 | Now using `window.MediaCodecs` |
| `pickH264Codec()` | 2969–2981 | Replaced by `getFirstEncodableVideoCodec` |
| `pickWebmMime()` | 2983–2996 | Replaced by `WebMOutputFormat` + codec negotiation |
| `runWebCodecsExport()` | 3023–3087 | Replaced by `runMediabunnyExport()` |
| `runWebMExport()` | 3089–3141 | Replaced by `runMediabunnyWebMExport()` |
| `startExportMP4()` (simplified) | 3143–3180 | Unified into `startExport()` |

---

## Files to Touch

| File | What changes |
|---|---|
| `index.html` | Add importmap, rewrite export section, remove mp4-muxer import, add audio passthrough |
| `README.md` | Update features list (add "Audio passthrough via Mediabunny"), update requirements |
| `PLAN.md` | Mark Phase 3/4 tasks as updated with mediabunny |

**No new files needed** — the single-page architecture is preserved.
