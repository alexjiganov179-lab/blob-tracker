import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appPath = join(__dirname, '..', '..', 'online-version', 'app.js');
const appSource = readFileSync(appPath, 'utf8');

// Extract a top-level class body by brace-counting (robust to nested braces).
function extractClass(src, name) {
  const start = src.indexOf('class ' + name);
  if (start === -1) throw new Error('class ' + name + ' not found in online-version/app.js');
  const braceStart = src.indexOf('{', start);
  let depth = 0;
  let i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  return src.slice(start, i);
}

const source = extractClass(appSource, 'CentroidTracker');
const CentroidTracker = eval('(' + source + ')');

const mk = (x, y = 100, s = 20) => ({
  x,
  y,
  area: s * s,
  bx: x - s / 2,
  by: y - s / 2,
  bw: s,
  bh: s,
  pts: [],
});

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('  ok -', name);
}

test('first detection receives id 1', () => {
  const tr = new CentroidTracker(50);
  const out = tr.update([mk(100)]);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 1);
});

test('nearby detection keeps the same id', () => {
  const tr = new CentroidTracker(50);
  const first = tr.update([mk(100)])[0];
  const second = tr.update([mk(130)])[0];
  assert.equal(second.id, first.id);
});

test('far detection gets a new id', () => {
  const tr = new CentroidTracker(20);
  const first = tr.update([mk(100)])[0];
  const second = tr.update([mk(160)])[0];
  assert.notEqual(second.id, first.id);
  assert.equal(second.id, 2);
});

test('track survives a short dropout and reuses the id', () => {
  const tr = new CentroidTracker(50);
  const first = tr.update([mk(100)])[0];
  tr.update([]);
  tr.update([]);
  const afterDropout = tr.update([mk(105)])[0];
  assert.equal(afterDropout.id, first.id);
});

test('track is removed after more than five missed frames', () => {
  const tr = new CentroidTracker(50);
  const first = tr.update([mk(100)])[0];
  for (let i = 0; i < 6; i++) tr.update([]);
  const afterLongDropout = tr.update([mk(100)])[0];
  assert.notEqual(afterLongDropout.id, first.id);
});

console.log('\n' + passed + ' tracker tests passed.');
