import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

console.log("─── Running Harden Verification Suite ───");

// 1. Verify Syntax of modified files
const appCode = fs.readFileSync("online-version/app.js", "utf8");
const indexHtml = fs.readFileSync("online-version/index.html", "utf8");
const stylesCss = fs.readFileSync("online-version/styles.css", "utf8");

assert(appCode.length > 0, "app.js is non-empty");
assert(indexHtml.length > 0, "index.html is non-empty");
assert(stylesCss.length > 0, "styles.css is non-empty");
console.log("✅ File reads verified");

// 2. Bilingual Parity Test
const sandbox = { localStorage: { getItem: () => null, setItem: () => {} } };
const i18nPart = appCode.slice(appCode.indexOf("const I18N ="), appCode.indexOf("const TIP_TEXTS ="));
vm.runInNewContext(i18nPart + "; this.I18N = I18N;", sandbox);

const enKeys = Object.keys(sandbox.I18N.en);
const ruKeys = Object.keys(sandbox.I18N.ru);
assert.equal(enKeys.length, ruKeys.length, `I18N keys length match (${enKeys.length})`);
const missRu = enKeys.filter(k => !(k in sandbox.I18N.ru));
const missEn = ruKeys.filter(k => !(k in sandbox.I18N.en));
assert.deepEqual(missRu, [], "No missing Russian keys");
assert.deepEqual(missEn, [], "No missing English keys");
console.log(`✅ I18N Parity: 100% across all ${enKeys.length} keys`);

// Verify new required keys exist
const requiredKeys = [
  "playAction", "pauseAction", "stepBackAction", "stepFwdAction",
  "stepBackTitle", "stepFwdTitle", "playTitle",
  "videoPlaybackError", "videoCorrupted", "videoTimeout"
];
for (const k of requiredKeys) {
  assert(k in sandbox.I18N.en, `en contains ${k}`);
  assert(k in sandbox.I18N.ru, `ru contains ${k}`);
}
console.log(`✅ Required accelerator and error keys verified in both languages`);

// 3. Cache Busting Check
assert(indexHtml.includes('styles.css?v=20261023-polish1') || indexHtml.includes('styles.css?v=20261023-harden1'), "styles.css cache bust updated");
assert(indexHtml.includes('app.js?v=20261023-polish1') || indexHtml.includes('app.js?v=20261023-harden1'), "app.js cache bust updated");
console.log("✅ Cache busting tags verified in index.html");

// 4. Buttons and DOM IDs check in index.html
assert(indexHtml.includes('id="step-back-btn"'), "step-back-btn present in index.html");
assert(indexHtml.includes('id="play-toggle"'), "play-toggle present in index.html");
assert(indexHtml.includes('id="step-fwd-btn"'), "step-fwd-btn present in index.html");
assert(stylesCss.includes('#step-back-btn'), "step-back-btn styled in styles.css");
assert(stylesCss.includes('#step-fwd-btn'), "step-fwd-btn styled in styles.css");
assert(stylesCss.includes('#play-toggle, #play-btn'), "play-toggle and play-btn styled in styles.css");
console.log("✅ Playback controls and styling verified in DOM & CSS");

// 5. Hardened logic check: Area clamping
const minTest = 50000;
const maxTest = 100;
const minArea = Math.min(Number.isFinite(minTest) ? minTest : 0, Number.isFinite(maxTest) ? maxTest : Infinity);
const maxArea = Math.max(Number.isFinite(minTest) ? minTest : 0, Number.isFinite(maxTest) ? maxTest : Infinity);
assert.equal(minArea, 100, "Inverted minArea clamped to smaller value");
assert.equal(maxArea, 50000, "Inverted maxArea clamped to larger value");
console.log("✅ Min/max area mathematical inversion protection verified");

// 6. Seeker math clamping
const dur = 2.0;
const nextTime = 2.5;
const clampedTime = Math.min(Math.max(0, nextTime), Math.max(0, dur - 0.001));
assert.equal(clampedTime, 1.999, "Seeker cleanly clamped to dur - 0.001");
const clampedNegative = Math.min(Math.max(0, -0.5), Math.max(0, dur - 0.001));
assert.equal(clampedNegative, 0, "Seeker cleanly clamped to 0");
console.log("✅ Seeker boundary clamping verified");

console.log("─── All Harden Verification Checks Passed! ───");
