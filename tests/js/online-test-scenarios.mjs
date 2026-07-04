// online-test-scenarios.mjs
// Individual test scenarios for online-version.
// Each function receives a test context { browser, port } and returns a summary.
//
// Scenario matrix:
//   1. H.264 + AAC → MP4   — verify H.264 + AAC, duration, decode
//   2. H.264 + AAC → WebM  — verify VPx + Opus, duration, decode
//   3. Video-only → MP4    — verify no audio
//   4. Video-only → WebM   — verify no audio
//   5. Vertical → MP4      — verify 1080×1920 output
//   6. 60 FPS → MP4        — verify source fps output
//   7. Cancel export       — verify clean stop

import {
  assert, resetAssertCounters, getAssertSummary,
  verifyOutput, parseFrameRate,
  ffprobeJson, getVideoStream, getAudioStreams,
  openApp, setupPageLogging, getPageLogs,
  uploadAndDetect, startExportAndDownload,
  setCodec, setOutputFps, getSourceFps,
  startExportAndCancel, checkAudioSampleLeaks,
  getFixturePath, OUTPUT_DIR,
} from './online-test-harness.mjs';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Run the standard export flow: open page, upload, detect, export.
 */
async function standardExportFlow(page, port, fixtureName, {
  codec = 'h264',
  outputFps = null,
} = {}) {
  await openApp(page, port);
  const outputSizeControls = await page.locator('#output-size').count();
  assert(outputSizeControls === 0, `No output size control is exposed (${outputSizeControls})`);

  const detectTime = await uploadAndDetect(page, getFixturePath(fixtureName));
  console.log(`     Detection: ${detectTime.toFixed(1)}s`);
  await verifyPlaybackAndCurrentFrameProbe(page);

  if (codec !== 'h264') {
    await setCodec(page, codec);
  }
  if (outputFps) {
    await setOutputFps(page, outputFps);
  }

  const result = await startExportAndDownload(page);
  console.log(`     Export: ${(result.sizeBytes / 1024).toFixed(1)} KB, "${result.suggestedName}"`);
  await page.waitForTimeout(2000);
  const postExportState = await page.evaluate(() => ({
    isExporting,
    exportBtnDisabled: exportBtn.disabled,
    exportBtnText: exportBtn.textContent,
    paused: video.paused,
    currentTime: video.currentTime,
    duration: video.duration,
    frames: all_frame_data.length,
  }));
  assert(!postExportState.isExporting, `isExporting resets after export (${postExportState.isExporting})`);
  assert(!postExportState.exportBtnDisabled, `Export button is enabled after export (${postExportState.exportBtnDisabled})`);
  assert(postExportState.exportBtnText === '⬇ Export',
    `Export button label is restored (got "${postExportState.exportBtnText}")`);
  assert(postExportState.frames > 0, `Detection data remains available after export (${postExportState.frames} frames)`);
  assert(!postExportState.paused && postExportState.currentTime < postExportState.duration - 0.02,
    `Playback resumes away from final frame after export (paused=${postExportState.paused}, t=${postExportState.currentTime.toFixed(3)}/${postExportState.duration.toFixed(3)})`);

  const logs = getPageLogs(page);
  return { ...result, detectTime, logs, postExportState };
}

async function verifyPlaybackAndCurrentFrameProbe(page) {
  await page.waitForSelector('#playback-controls.visible', { timeout: 10000 });
  const controlsVisible = await page.locator('#playback-controls.visible').count();
  assert(controlsVisible === 1, `Playback controls are visible (${controlsVisible})`);

  await page.click('#play-toggle');
  await page.waitForFunction(() => video.paused === true, undefined, { timeout: 5000 });
  const pausedState = await page.evaluate(() => ({
    paused: video.paused,
    time: video.currentTime,
    duration: video.duration,
    button: document.getElementById('play-toggle')?.textContent,
  }));
  assert(pausedState.paused, `Play toggle pauses playback (${pausedState.paused})`);
  assert(pausedState.button === '▶', `Play button switches to play icon (${pausedState.button})`);

  const seekState = await page.evaluate(async () => {
    const tl = document.getElementById('timeline');
    tl.value = '500';
    tl.dispatchEvent(new Event('input', { bubbles: true }));
    tl.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 600));
    return {
      paused: video.paused,
      time: video.currentTime,
      duration: video.duration,
      timeline: tl.value,
      readout: document.getElementById('time-readout')?.textContent || '',
    };
  });
  assert(seekState.paused, `Timeline scrub keeps video paused (${seekState.paused})`);
  assert(seekState.duration > 0 && Math.abs(seekState.time - seekState.duration / 2) < 0.35,
    `Timeline seeks near midpoint (t=${seekState.time.toFixed(3)}, d=${seekState.duration.toFixed(3)})`);
  assert(seekState.readout.includes('/'), `Time readout updates (${seekState.readout})`);

  const probeState = await page.evaluate(async () => {
    const slider = document.getElementById('canny-low');
    slider.value = String(Math.min(255, Number(slider.value) + 5));
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 900));
    const status = document.getElementById('probe-status');
    return {
      visible: status?.classList.contains('visible') || false,
      text: status?.textContent || '',
      probeCount: currentFrameProbe ? currentFrameProbe.blobs.length : -1,
    };
  });
  assert(probeState.visible, `Current-frame probe status is visible (${probeState.text})`);
  assert(probeState.text.includes('Current frame preview') || probeState.text.includes('Превью текущего кадра'),
    `Current-frame probe completes (${probeState.text})`);
  assert(probeState.probeCount >= 0, `Current-frame probe stores blobs (${probeState.probeCount})`);

  await page.click('#play-toggle');
  await page.waitForFunction(() => video.paused === false, undefined, { timeout: 5000 });
}

function checkCommon(logs) {
  const leaks = checkAudioSampleLeaks(logs.messages);
  assert(leaks.length === 0, `No AudioSample leaks (${leaks.length})`);
  assert(logs.errors.length === 0, `No page errors (${logs.errors.length})`);
  for (const err of logs.errors) console.error('       Page error:', err);
}

// ─────────────────────────────────────────────────────────────
// Scenario 1: H.264 + AAC → MP4
// ─────────────────────────────────────────────────────────────

export async function testMp4Audio({ browser, port }) {
  console.log('\n═══ Scenario 1: H.264 + AAC → MP4 ═══');
  resetAssertCounters();

  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  setupPageLogging(page);

  try {
    const result = await standardExportFlow(page, port, 'av-audio');

    verifyOutput({
      filePath: result.filePath,
      expectAudio: true,
      expectedAudioCodec: 'aac',
      expectedVideoCodec: 'h264',
      expectedDuration: 2.0,
      checkDecode: true,
    });

    checkCommon(result.logs);
  } finally {
    await page.close();
    await ctx.close();
  }

  return { name: 'MP4 + AAC', ...getAssertSummary() };
}

// ─────────────────────────────────────────────────────────────
// Scenario 2: H.264 + AAC → WebM
// ─────────────────────────────────────────────────────────────

export async function testWebmAudio({ browser, port }) {
  console.log('\n═══ Scenario 2: H.264 + AAC → WebM ═══');
  resetAssertCounters();

  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  setupPageLogging(page);

  try {
    const result = await standardExportFlow(page, port, 'av-audio', {
      codec: 'webm',
    });

    verifyOutput({
      filePath: result.filePath,
      expectAudio: true,
      expectedAudioCodec: 'opus',
      expectedVideoCodec: null,
      expectedDuration: 2.0,
      durationTolerance: 0.1, // WebM encoders may add slight padding
      checkDecode: true,
    });

    // Relaxed video codec check for WebM
    const info = ffprobeJson(result.filePath);
    const vStream = getVideoStream(info);
    if (vStream) {
      const validCodecs = ['vp8', 'vp9', 'av1'];
      const codec = vStream.codec_name.toLowerCase();
      assert(validCodecs.includes(codec),
        `WebM video codec is VP8/VP9/AV1 (got ${vStream.codec_name})`);
    }

    checkCommon(result.logs);
  } finally {
    await page.close();
    await ctx.close();
  }

  return { name: 'WebM + AAC', ...getAssertSummary() };
}

// ─────────────────────────────────────────────────────────────
// Scenario 3: Video-only → MP4
// ─────────────────────────────────────────────────────────────

export async function testMp4VideoOnly({ browser, port }) {
  console.log('\n═══ Scenario 3: Video-only → MP4 ═══');
  resetAssertCounters();

  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  setupPageLogging(page);

  try {
    const result = await standardExportFlow(page, port, 'av-video-only');

    verifyOutput({
      filePath: result.filePath,
      expectAudio: false,
      expectedVideoCodec: 'h264',
      expectedDuration: 2.0,
      expectDimensions: { w: 320, h: 240 },
      checkDecode: true,
    });

    checkCommon(result.logs);
  } finally {
    await page.close();
    await ctx.close();
  }

  return { name: 'MP4 video-only', ...getAssertSummary() };
}

// ─────────────────────────────────────────────────────────────
// Scenario 4: Video-only → WebM
// ─────────────────────────────────────────────────────────────

export async function testWebmVideoOnly({ browser, port }) {
  console.log('\n═══ Scenario 4: Video-only → WebM ═══');
  resetAssertCounters();

  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  setupPageLogging(page);

  try {
    const result = await standardExportFlow(page, port, 'av-video-only', {
      codec: 'webm',
    });

    verifyOutput({
      filePath: result.filePath,
      expectAudio: false,
      expectedVideoCodec: null,
      expectedDuration: 2.0,
      expectDimensions: { w: 320, h: 240 },
      checkDecode: true,
    });

    const info = ffprobeJson(result.filePath);
    const vStream = getVideoStream(info);
    if (vStream) {
      const validCodecs = ['vp8', 'vp9', 'av1'];
      const codec = vStream.codec_name.toLowerCase();
      assert(validCodecs.includes(codec),
        `WebM video codec is VP8/VP9/AV1 (got ${vStream.codec_name})`);
    }

    checkCommon(result.logs);
  } finally {
    await page.close();
    await ctx.close();
  }

  return { name: 'WebM video-only', ...getAssertSummary() };
}

// ─────────────────────────────────────────────────────────────
// Scenario 5: Vertical source-size video → MP4
// ─────────────────────────────────────────────────────────────

export async function testVerticalVideo({ browser, port }) {
  console.log('\n═══ Scenario 5: Vertical 9:16 → MP4 at source size ═══');
  resetAssertCounters();

  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  setupPageLogging(page);

  try {
    const result = await standardExportFlow(page, port, 'av-vertical');

    verifyOutput({
      filePath: result.filePath,
      expectAudio: false,
      expectedVideoCodec: 'h264',
      expectedDuration: 2.0,
      expectDimensions: { w: 1080, h: 1920 },
      checkDecode: true,
    });

    checkCommon(result.logs);
  } finally {
    await page.close();
    await ctx.close();
  }

  return { name: 'Vertical source size', ...getAssertSummary() };
}

// ─────────────────────────────────────────────────────────────
// Scenario 6: 60 FPS → MP4 (Source FPS)
// ─────────────────────────────────────────────────────────────

export async function test60fps({ browser, port }) {
  console.log('\n═══ Scenario 6: 60 FPS source → MP4 at Source FPS ═══');
  resetAssertCounters();

  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  setupPageLogging(page);

  try {
    await openApp(page, port);

    const detectTime = await uploadAndDetect(page, getFixturePath('av-60fps'));
    console.log(`     Detection: ${detectTime.toFixed(1)}s`);

    const sourceFps = await getSourceFps(page);
    console.log(`     Detected source FPS: ${sourceFps}`);

    // Switch to Source FPS (triggers re-detect)
    await setOutputFps(page, 'source');

    const result = await startExportAndDownload(page);
    console.log(`     Export: ${(result.sizeBytes / 1024).toFixed(1)} KB, "${result.suggestedName}"`);

    const logs = getPageLogs(page);

    verifyOutput({
      filePath: result.filePath,
      expectAudio: false,
      expectedVideoCodec: 'h264',
      expectedDuration: 2.0,
      checkDecode: true,
    });

    // Verify output framerate
    const info = ffprobeJson(result.filePath);
    const vStream = getVideoStream(info);
    if (vStream && sourceFps) {
      const outFps = parseFrameRate(vStream.r_frame_rate);
      console.log(`     Output r_frame_rate: ${vStream.r_frame_rate} → ${outFps?.toFixed(1)} fps`);
      if (outFps) {
        assert(Math.abs(outFps - sourceFps) < 5,
          `Output FPS (${outFps?.toFixed(1)}) ≈ source FPS (${sourceFps})`);
      }
    }

    checkCommon(logs);
  } finally {
    await page.close();
    await ctx.close();
  }

  return { name: '60 FPS → Source', ...getAssertSummary() };
}

// ─────────────────────────────────────────────────────────────
// Scenario 7: Cancel export
// ─────────────────────────────────────────────────────────────

export async function testCancelExport({ browser, port }) {
  console.log('\n═══ Scenario 7: Cancel export (long video) ═══');
  resetAssertCounters();

  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  setupPageLogging(page);

  try {
    await openApp(page, port);

    const detectTime = await uploadAndDetect(page, getFixturePath('av-long'));
    console.log(`     Detection: ${detectTime.toFixed(1)}s`);

    const state = await startExportAndCancel(page);
    console.log('     Post-cancel state:', JSON.stringify(state));

    assert(!state.isExporting,
      `isExporting is false after cancel (got ${state.isExporting_raw})`);
    assert(state.exportBtnText === '⬇ Export',
      `Export button shows "⬇ Export" (got "${state.exportBtnText}")`);

    const canInteract = await page.evaluate(() => {
      try {
        return document.getElementById('export-btn') !== null;
      } catch { return false; }
    });
    assert(canInteract, 'Page is still responsive after cancel');

    const logs = getPageLogs(page);
    const leaks = checkAudioSampleLeaks(logs.messages);
    assert(leaks.length === 0, `No AudioSample leaks (${leaks.length})`);

    const unexpectedErrors = logs.errors.filter(e =>
      !e.toLowerCase().includes('cancel') &&
      !e.toLowerCase().includes('abort') &&
      !e.toLowerCase().includes('stop'));
    assert(unexpectedErrors.length === 0,
      `No unexpected page errors (${unexpectedErrors.length})`);
    for (const err of unexpectedErrors) console.error('       Unexpected error:', err);

  } finally {
    await page.close();
    await ctx.close();
  }

  return { name: 'Cancel export', ...getAssertSummary() };
}
