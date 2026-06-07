// Smoke test: load index.html in headless Chromium, capture console + errors.
// Verifies the new Phase 3 features (Trail, Audio, Output Size, Codec) parse
// and initialize without throwing.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const errors = [];
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => errors.push(`PAGE ERROR: ${e.message}`));
  page.on('requestfailed', r => {
    const url = r.url();
    // presets.json via file:// is expected to fail in this harness; we serve via http.
    if (url.startsWith('http://')) errors.push(`REQUEST FAILED: ${url} ${r.failure().errorText}`);
  });

  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  // Give OpenCV a moment to load.
  await page.waitForTimeout(2000);

  // Check that the new UI elements are present and clickable.
  const checks = await page.evaluate(() => {
    const out = {};
    out.trailSlider = !!document.getElementById('trail-length');
    out.trailButton = !!document.querySelector('.gbtn[data-val="Trail"]');
    out.outputSize = !!document.getElementById('output-size');
    out.outputCodec = !!document.getElementById('output-codec');
    // The state object
    out.P_hasTrail = typeof P.trailLength === 'number';
    out.P_hasOutputSize = typeof P.outputSize === 'string';
    out.P_hasOutputCodec = typeof P.outputCodec === 'string';
    // The global helpers
    out.TrailBufferDefined = typeof TrailBuffer === 'object' && typeof TrailBuffer.push === 'function';
    out.pickH264Defined = typeof pickH264Codec === 'function';
    out.pickWebmDefined = typeof pickWebmMime === 'function';
    out.runWebCodecsDefined = typeof runWebCodecsExport === 'function';
    out.runWebMDefined = typeof runWebMExport === 'function';
    out.renderToTargetDefined = typeof renderToTarget === 'function';
    // Effects registry includes Trail
    out.effectsHasTrail = !!EFFECTS_BY_ID['Trail'];
    // Audio reactive should be fully removed. Browsers expose a built-in
    // `Audio` constructor (HTMLAudioElement), so probe a custom property
    // that only existed on our module.
    out.audioSourceRemoved = !document.getElementById('audio-source');
    out.audioMeterRemoved = !document.getElementById('audio-meter-fill');
    out.audioModuleRemoved = (typeof Audio === 'undefined') || (typeof Audio.tick !== 'function' && typeof Audio.useMic !== 'function');
    out.P_hasNoAudioSource = typeof P.audioSource === 'undefined';
    return out;
  });

  console.log('=== UI + state checks ===');
  for (const [k, v] of Object.entries(checks)) {
    console.log((v ? 'OK   ' : 'FAIL ') + k + ': ' + v);
  }

  // Click the Trail effect to exercise the handler.
  await page.click('.gbtn[data-val="Trail"]');
  await page.click('#trail-length');  // focus
  await page.evaluate(() => {
    const s = document.getElementById('trail-length');
    s.value = 5; s.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('#output-size button[data-val="1080p"]');
  await page.click('#output-codec button[data-val="webm"]');
  await page.click('#output-codec button[data-val="h264"]');
  await page.click('#output-size button[data-val="preview"]');

  const finalState = await page.evaluate(() => ({
    selectedEffect: P.selectedEffect,
    trailLength: P.trailLength,
    outputSize: P.outputSize,
    outputCodec: P.outputCodec,
  }));
  console.log('\n=== Final state after clicks ===');
  console.log(JSON.stringify(finalState, null, 2));

  // Reset to defaults.
  await page.click('#reset-btn');
  const resetState = await page.evaluate(() => ({
    selectedEffect: P.selectedEffect,
    trailLength: P.trailLength,
    outputSize: P.outputSize,
    outputCodec: P.outputCodec,
  }));
  console.log('\n=== State after reset ===');
  console.log(JSON.stringify(resetState, null, 2));

  console.log('\n=== Console (' + logs.length + ' entries) ===');
  for (const l of logs.slice(0, 40)) console.log(l);

  if (errors.length) {
    console.log('\n=== ERRORS (' + errors.length + ') ===');
    for (const e of errors) console.log(e);
  } else {
    console.log('\nNo page errors.');
  }

  await browser.close();
  const allOk = Object.values(checks).every(Boolean) && errors.length === 0;
  process.exit(allOk ? 0 : 1);
})();
