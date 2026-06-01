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

// 5) A long dropout (> MAX_MISSED frames) drops the track; reappearance gets a NEW id.
test('track dies after a dropout > MAX_MISSED and returns with a new id', () => {
  const tr = new CentroidTracker(1000);
  tr.update([mk(100)]);           // age 1
  let out = tr.update([mk(100)]); // age 2 -> visible
  const firstId = out[0].id;
  // MAX_MISSED = 5, so 6 consecutive blind frames must delete the track.
  for (let i = 0; i < 6; i++) out = tr.update([]);
  assert.equal(out.length, 0, 'track is gone after > MAX_MISSED blind frames');
  // Reappears: it is a fresh candidate, so still invisible on its first frame...
  out = tr.update([mk(100)]);
  assert.equal(out.length, 0, 'reappearance starts as a new unconfirmed candidate');
  // ...and becomes visible again on the next frame with a brand-new id.
  out = tr.update([mk(100)]);
  assert.equal(out.length, 1, 'reappearance promoted on its second frame');
  assert.notEqual(out[0].id, firstId, 'a dropped-then-returned object gets a new id');
});

console.log('\n' + passed + ' tracker tests passed.');
