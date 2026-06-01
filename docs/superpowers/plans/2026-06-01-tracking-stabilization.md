# Tracking Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calm the jittery, flickering blob overlays (even around static objects) by stabilizing the tracker: EMA position/size smoothing, ghost-blob suppression, and short-dropout tolerance.

**Architecture:** All behavior changes are contained in the `CentroidTracker` class in `index.html` (currently lines 938–954). The class stops being stateless-per-previous-frame and instead maintains a list of *live tracks* with age/missed counters and smoothed position. Its public interface (`new CentroidTracker(diagonal)` + `update(blobs) -> blobs[]`) is unchanged, so `detectBlobs`, rendering, export, and re-detect are untouched and inherit the fix through `all_frame_data`.

**Tech Stack:** Vanilla browser JS (`index.html`), OpenCV.js (unchanged). Tests run in Node 24 via a standalone `.mjs` script that extracts the class from `index.html` — there is no browser test framework, and the existing `pytest` suite only covers the Python `v2`/Streamlit code.

**Reference spec:** `docs/superpowers/specs/2026-06-01-tracking-stabilization-design.md`

---

## File Structure

- **Modify:** `index.html` — replace the `CentroidTracker` class body (lines 938–954). No other production code changes.
- **Create:** `tests/js/test_centroid_tracker.mjs` — Node logic tests for the tracker (extracts the class from `index.html`, no DOM/video).
- **Create:** `tests/js/check_syntax.mjs` — committed reproducible syntax guard for `index.html` inline scripts (replaces the ad-hoc temp script used earlier).

The new `CentroidTracker.update()` returns blobs in the exact shape the renderer already consumes (`{id, x, y, area, bw, bh, bx, by, pts}`), where `bx/by` are derived from the smoothed center and size: `bx = round(x - bw/2)`, `by = round(y - bh/2)`. For the in-scope Circle/BBox shapes this is correct and more stable; the out-of-scope Contour shape passes `pts` through unsmoothed.

---

## Task 1: Stabilize CentroidTracker (TDD)

**Files:**
- Create: `tests/js/test_centroid_tracker.mjs`
- Modify: `index.html:938-954` (the `CentroidTracker` class)

- [ ] **Step 1: Write the failing logic tests**

Create `tests/js/test_centroid_tracker.mjs` with this exact content:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dirname, '..', '..', 'index.html');
const html = readFileSync(htmlPath, 'utf8');

// Extract a top-level class body by brace-counting (robust to nested braces).
// The CentroidTracker body contains no string/comment braces, so this is exact.
function extractClass(src, name) {
  const start = src.indexOf('class ' + name);
  if (start === -1) throw new Error('class ' + name + ' not found in index.html');
  const braceStart = src.indexOf('{', start);
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

const source = extractClass(html, 'CentroidTracker');
const CentroidTracker = eval('(' + source + ')');

// Synthetic detection blob (shape matches detectContours output).
const mk = (x, y = 100, s = 20) => ({
  x, y, area: s * s, bx: x - s / 2, by: y - s / 2, bw: s, bh: s, pts: [],
});

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('  ok -', name); }

// 1) A 1-frame ghost blob is never shown.
test('ghost blob (1 frame) is never returned', () => {
  const tr = new CentroidTracker(1000); // maxD = 50
  let out = tr.update([mk(100)]);
  assert.equal(out.length, 0, 'brand-new blob is not shown on its first frame');
  out = tr.update([]); // ghost vanished
  assert.equal(out.length, 0, 'ghost is never promoted to visible');
});

// 2) A real object keeps its id through a short dropout.
test('object keeps id across a dropout of <= MAX_MISSED frames', () => {
  const tr = new CentroidTracker(1000);
  tr.update([mk(100)]);           // age 1 (not yet visible)
  let out = tr.update([mk(100)]); // age 2 -> visible
  assert.equal(out.length, 1, 'object visible on its second frame');
  const id = out[0].id;
  out = tr.update([]);            // blind frame 1
  assert.equal(out[0].id, id, 'track held during blind frame');
  out = tr.update([]);            // blind frame 2
  assert.equal(out[0].id, id);
  out = tr.update([mk(105)]);     // reappears nearby
  assert.equal(out[0].id, id, 'same id after reappearing');
});

// 3) A static object's reported center stays put (smoothing converges and holds).
test('static object center holds steady', () => {
  const tr = new CentroidTracker(1000);
  let out;
  for (let i = 0; i < 10; i++) out = tr.update([mk(200, 200, 40)]);
  assert.ok(Math.abs(out[0].x - 200) < 1, 'x stays at 200, got ' + out[0].x);
  assert.ok(Math.abs(out[0].y - 200) < 1, 'y stays at 200, got ' + out[0].y);
});

// 4) A moving object's center tracks toward the new position.
test('moving object center follows the motion', () => {
  const tr = new CentroidTracker(1000);
  tr.update([mk(100)]); tr.update([mk(100)]); // establish at x=100
  let out;
  for (let i = 0; i < 8; i++) out = tr.update([mk(130)]); // drift to x=130
  assert.ok(out[0].x > 125, 'center converged toward 130, got ' + out[0].x);
});

console.log('\n' + passed + ' tracker tests passed.');
```

- [ ] **Step 2: Run the tests to verify they FAIL against the current class**

Run: `node tests/js/test_centroid_tracker.mjs`
Expected: FAIL on the first test — an `AssertionError` like
`brand-new blob is not shown on its first frame` (the current class returns the blob immediately, so `out.length` is `1`, not `0`).

- [ ] **Step 3: Replace the `CentroidTracker` class**

In `index.html`, replace the entire current class (lines 938–954):

```js
class CentroidTracker {
  constructor(d){this.maxD=d*0.05;this.nextId=0;this.prev=[];}
  update(blobs){
    const consumed=new Set();
    for (const b of blobs){
      let bestIdx=null,bestDist=this.maxD;
      for (let i=0;i<this.prev.length;i++){
        if(consumed.has(i))continue;
        const dx=b.x-this.prev[i].x,dy=b.y-this.prev[i].y,d=Math.sqrt(dx*dx+dy*dy);
        if(d<bestDist){bestDist=d;bestIdx=i;}
      }
      if(bestIdx===null){b.id=this.nextId++;}
      else{b.id=this.prev[bestIdx].id;consumed.add(bestIdx);}
    }
    this.prev=blobs;return blobs;
  }
}
```

with this exact new class:

```js
class CentroidTracker {
  // --- Tunable stabilization constants (adjust after watching real video) ---
  static SMOOTHING_ALPHA = 0.4; // 0..1; lower = calmer/more inertia, higher = snappier
  static MIN_AGE = 2;           // frames a track must persist before it is shown (kills ghosts)
  static MAX_MISSED = 5;        // frames a track survives unmatched before deletion (dropout grace)

  constructor(d){
    this.maxD = d * 0.05;
    this.nextId = 0;
    this.tracks = [];           // live tracks: {id,x,y,bw,bh,area,pts,age,missed,visible,matched}
  }

  update(blobs){
    const A = CentroidTracker.SMOOTHING_ALPHA;
    const consumed = new Set();
    const nExisting = this.tracks.length; // only match against tracks present at frame start

    // 1+2+3. Match detections to nearest live track; smooth matches, spawn candidates.
    for (const b of blobs){
      let bestIdx = null, bestDist = this.maxD;
      for (let i=0;i<nExisting;i++){
        if (consumed.has(i)) continue;
        const t = this.tracks[i];
        const dx = b.x - t.x, dy = b.y - t.y, d = Math.sqrt(dx*dx + dy*dy);
        if (d < bestDist){ bestDist = d; bestIdx = i; }
      }
      if (bestIdx === null){
        // New candidate — position taken directly (no smoothing yet), no id until promoted.
        this.tracks.push({
          id: null, x: b.x, y: b.y, bw: b.bw, bh: b.bh, area: b.area,
          pts: b.pts, age: 1, missed: 0, visible: false, matched: true,
        });
      } else {
        const t = this.tracks[bestIdx];
        t.x = t.x*(1-A) + b.x*A;
        t.y = t.y*(1-A) + b.y*A;
        t.bw = t.bw*(1-A) + b.bw*A;
        t.bh = t.bh*(1-A) + b.bh*A;
        t.area = t.area*(1-A) + b.area*A;
        t.pts = b.pts;          // contour points passed through, not smoothed (out of scope)
        t.missed = 0;
        t.age++;
        t.matched = true;
        consumed.add(bestIdx);
      }
    }

    // 4. Age out tracks that were not matched this frame; delete after MAX_MISSED.
    const survivors = [];
    for (const t of this.tracks){
      if (!t.matched){
        t.missed++;
        if (t.missed > CentroidTracker.MAX_MISSED) continue; // drop dead track
      }
      t.matched = false; // reset flag for next frame
      survivors.push(t);
    }
    this.tracks = survivors;

    // 5. Promote tracks that have persisted long enough (assigns the permanent id).
    for (const t of this.tracks){
      if (!t.visible && t.age >= CentroidTracker.MIN_AGE){
        t.visible = true;
        t.id = this.nextId++;
      }
    }

    // 6. Return only visible tracks in the renderer's expected blob shape.
    return this.tracks.filter(t => t.visible).map(t => ({
      id: t.id,
      x: Math.round(t.x),
      y: Math.round(t.y),
      area: t.area,
      bw: Math.round(t.bw),
      bh: Math.round(t.bh),
      bx: Math.round(t.x - t.bw/2),
      by: Math.round(t.y - t.bh/2),
      pts: t.pts,
    }));
  }
}
```

- [ ] **Step 4: Run the tests to verify they PASS**

Run: `node tests/js/test_centroid_tracker.mjs`
Expected output (last line):
```
4 tracker tests passed.
```

- [ ] **Step 5: Commit**

```bash
git add tests/js/test_centroid_tracker.mjs index.html
git commit -m "feat: stabilize blob tracker (EMA smoothing, ghost suppression, dropout tolerance)"
```

---

## Task 2: Add a committed syntax guard for index.html

**Files:**
- Create: `tests/js/check_syntax.mjs`

- [ ] **Step 1: Create the syntax checker**

Create `tests/js/check_syntax.mjs` with this exact content:

```js
// Parses every inline <script> block in index.html and reports syntax errors.
// Reproducible replacement for the earlier ad-hoc temp checker.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '..', '..', 'index.html'), 'utf8');

const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let m, n = 0, errors = 0;
while ((m = re.exec(html)) !== null) {
  const code = m[1];
  if (!code.trim()) continue; // skip external-src / empty scripts
  n++;
  try {
    new vm.Script(code, { filename: 'inline-script-' + n });
    console.log('script #' + n + ': OK (' + code.split('\n').length + ' lines)');
  } catch (e) {
    errors++;
    console.log('script #' + n + ': SYNTAX ERROR -> ' + e.message);
  }
}
console.log('Checked ' + n + ' inline scripts; ' + errors + ' syntax error(s).');
process.exit(errors ? 1 : 0);
```

- [ ] **Step 2: Run it to verify index.html is syntactically clean**

Run: `node tests/js/check_syntax.mjs`
Expected output:
```
script #1: OK (6 lines)
script #2: OK (... lines)
Checked 2 inline scripts; 0 syntax error(s).
```
(Exit code 0. The line count of script #2 will differ slightly from before — that is expected after the class rewrite.)

- [ ] **Step 3: Commit**

```bash
git add tests/js/check_syntax.mjs
git commit -m "test: add committed syntax guard for index.html inline scripts"
```

---

## Task 3: Browser integration + visual verification & tuning

This task has **no code edits** unless tuning is needed. It confirms the running app still detects blobs, throws no console errors, and looks calm on real video.

**Files:** none (verification only; optional one-line tuning in `index.html`)

- [ ] **Step 1: Start the local server**

Run (from `E:\blob_tracker`): `py -3.12 -m http.server 8000`
Then open `http://localhost:8000/index.html` in Chrome/Edge and hard-refresh once (Ctrl+Shift+R) to clear any stale cache.

(Agentic workers may instead use the `Claude_Preview` MCP: `preview_start` with the `blob-tracker` config from `.claude/launch.json`, then drive `preview_eval` against the returned `serverId`.)

- [ ] **Step 2: Confirm the tracker still runs and is wired correctly**

In the browser DevTools console (or via `preview_eval`), run:

```js
JSON.stringify({
  hasClass: typeof CentroidTracker,
  consts: [CentroidTracker.SMOOTHING_ALPHA, CentroidTracker.MIN_AGE, CentroidTracker.MAX_MISSED],
  smoke: (() => {
    const tr = new CentroidTracker(1000);
    tr.update([{x:50,y:50,area:400,bx:40,by:40,bw:20,bh:20,pts:[]}]);
    const out = tr.update([{x:50,y:50,area:400,bx:40,by:40,bw:20,bh:20,pts:[]}]);
    return { len: out.length, id: out[0] && out[0].id, x: out[0] && out[0].x };
  })()
})
```

Expected: `hasClass: "function"`, `consts: [0.4, 2, 5]`, `smoke: { len: 1, id: 0, x: 50 }`.

- [ ] **Step 3: Process a real video and watch for errors**

Load a sample/real video in the app, let detection finish, let it play. Then check the console has no red errors:

```js
// via preview MCP:
// preview_console_logs({ serverId, level: "error" })  -> expect "No console logs"
```

Confirm overlays appear (Circle or BBox shape) and play back.

- [ ] **Step 4: Visual judgement (the primary acceptance test)**

Watch the overlay on a real clip, especially around a **stationary** object. Judge:
- Static object → overlay should sit still (no constant jiggle).
- No tiny flickering boxes flashing around the subject.
- Fast motion → overlay follows with only slight, acceptable lag.

- [ ] **Step 5: Tune if needed (only if Step 4 fails)**

Adjust the three constants at the top of `CentroidTracker` in `index.html`, then re-run `node tests/js/test_centroid_tracker.mjs` (must still print `4 tracker tests passed.`) and re-check visually:
- "Still jittery / shaky" → lower `SMOOTHING_ALPHA` (e.g. `0.3`) for more smoothing; raise `MIN_AGE` to `3` to suppress more ghosts.
- "Too laggy / drags behind motion" → raise `SMOOTHING_ALPHA` (e.g. `0.5`–`0.6`).
- "Overlay vanishes too quickly on brief occlusion" → raise `MAX_MISSED` (e.g. `8`).
- "New objects take too long to appear" → lower `MIN_AGE` to `1` (note: this lets more ghosts through).

If tuned, commit:
```bash
git add index.html
git commit -m "tune: adjust tracker stabilization constants after visual review"
```

- [ ] **Step 6: Finish the branch**

Once visual verification passes, use the `superpowers:finishing-a-development-branch` skill (or merge `feat/tracking-stabilization` into `master` as in prior work).

---

## Self-Review Notes

- **Spec coverage:** jitter→EMA (Step 3 update block); ghosts→`MIN_AGE` promotion + tests #1; dropouts→`MAX_MISSED` grace + test #2; Circle/BBox scope→derived `bx/by`, `pts` pass-through; balanced strength→`SMOOTHING_ALPHA=0.4`; tunable constants→static fields + Task 3 Step 5; verification→Task 1 (logic) + Task 3 (visual). All covered.
- **No placeholders:** every code/test/command step is complete and runnable.
- **Type/name consistency:** `update(blobs)` returns `{id,x,y,area,bw,bh,bx,by,pts}` (matches `interpolateBlobs`/`drawEffectLayer` consumers); class name `CentroidTracker` and constants `SMOOTHING_ALPHA`/`MIN_AGE`/`MAX_MISSED` used identically in tests, class, and tuning step.
