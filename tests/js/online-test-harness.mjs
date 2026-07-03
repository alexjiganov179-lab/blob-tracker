// online-test-harness.mjs
// Shared infrastructure for online-version test suite.
//   - HTTP server, browser lifecycle, ffprobe/ffmpeg helpers
//   - Test fixture generation
//   - Common assertions
//
// Usage:
//   import { createTestHarness } from './online-test-harness.mjs';

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, extname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

// ─────────────────────────────────────────────────────────────
// Paths
// ─────────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = resolvePath(__dir, '..', '..');
export const ONLINE_DIR = join(ROOT_DIR, 'online-version');
export const FIXTURES_DIR = join(__dir, 'fixtures');
export const OUTPUT_DIR = join(__dir, '_test_output');

// Chromium executable — fallback chain
const CHROMIUM_PATHS = [
  join('C:', 'Users', '1234', 'AppData', 'Local', 'ms-playwright',
       'chromium-1228', 'chrome-win64', 'chrome.exe'),
  join('C:', 'Users', '1234', 'AppData', 'Local', 'ms-playwright',
       'chromium-1224', 'chrome-win64', 'chrome.exe'),
  join('C:', 'Users', '1234', 'AppData', 'Local', 'ms-playwright',
       'chromium-1223', 'chrome-win64', 'chrome.exe'),
];

function findChrome() {
  for (const p of CHROMIUM_PATHS) {
    if (existsSync(p)) return p;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Assertion helpers
// ─────────────────────────────────────────────────────────────

let totalAsserts = 0;
let failedAsserts = 0;

export function resetAssertCounters() {
  totalAsserts = 0;
  failedAsserts = 0;
}

export function getAssertSummary() {
  return { total: totalAsserts, failed: failedAsserts };
}

export function assert(cond, msg) {
  totalAsserts++;
  if (cond) {
    console.log('  ✅', msg);
  } else {
    console.error('  ❌', msg);
    failedAsserts++;
  }
}

// ─────────────────────────────────────────────────────────────
// ffprobe / ffmpeg helpers
// ─────────────────────────────────────────────────────────────

export function ffprobeJson(filePath) {
  const out = execSync(
    `ffprobe -v quiet -print_format json -show_streams -show_format "${filePath}"`,
    { encoding: 'utf-8', timeout: 15000 },
  );
  return JSON.parse(out);
}

export function ffmpegDecode(filePath) {
  execSync(
    `ffmpeg -v error -i "${filePath}" -f null -`,
    { encoding: 'utf-8', timeout: 30000 },
  );
}

/**
 * Return the video stream info (first video stream) from ffprobe output.
 */
export function getVideoStream(info) {
  return info.streams.find(s => s.codec_type === 'video') || null;
}

/**
 * Return all audio streams from ffprobe output.
 */
export function getAudioStreams(info) {
  return info.streams.filter(s => s.codec_type === 'audio');
}

/**
 * Parse frame rate string like "30000/1001" or "60/1" to a number.
 */
export function parseFrameRate(rFrameRate) {
  if (!rFrameRate || rFrameRate === '0/0') return null;
  const parts = rFrameRate.split('/');
  if (parts.length === 2) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    return den !== 0 ? num / den : null;
  }
  return parseFloat(rFrameRate);
}

/**
 * Verify output file meets expectations. Runs common checks.
 * Returns number of failed assertions.
 */
export function verifyOutput({ filePath, expectAudio, expectedAudioCodec,
                               expectedVideoCodec, expectedDuration,
                               durationTolerance = 0.05, expectDimensions,
                               checkDecode = true }) {
  const failuresBefore = failedAsserts;
  const info = ffprobeJson(filePath);

  // Video track
  const vStream = getVideoStream(info);
  assert(!!vStream, `Video stream present`);

  if (vStream && expectedVideoCodec) {
    assert(vStream.codec_name === expectedVideoCodec,
      `Video codec is ${expectedVideoCodec} (got ${vStream.codec_name})`);
  }

  // Dimensions
  if (vStream && expectDimensions) {
    assert(vStream.width === expectDimensions.w && vStream.height === expectDimensions.h,
      `Video dimensions ${expectDimensions.w}x${expectDimensions.h} (got ${vStream.width}x${vStream.height})`);
  }

  // Audio track
  const aStreams = getAudioStreams(info);
  if (expectAudio) {
    assert(aStreams.length > 0, `Audio track(s) present (got ${aStreams.length})`);
    if (expectedAudioCodec && aStreams.length > 0) {
      assert(aStreams[0].codec_name === expectedAudioCodec,
        `Audio codec is ${expectedAudioCodec} (got ${aStreams[0].codec_name})`);
    }
  } else {
    assert(aStreams.length === 0,
      `No audio track present (got ${aStreams.length})`);
  }

  // Duration
  if (expectedDuration != null) {
    const actualDur = parseFloat(info.format.duration);
    assert(Math.abs(actualDur - expectedDuration) < durationTolerance,
      `Duration ${actualDur.toFixed(3)}s ≈ ${expectedDuration}s (±${durationTolerance}s)`);
  }

  // Full decode
  if (checkDecode) {
    try {
      ffmpegDecode(filePath);
      assert(true, 'Full decode passed without errors');
    } catch (e) {
      assert(false, 'Full decode failed: ' + e.message);
    }
  }

  // Framerate (if expected)
  if (vStream && expectedDuration != null) {
    const actualDur = parseFloat(info.format.duration);
    const expectedFrames = Math.round(expectedDuration * 30); // assume 30fps
    // Check that the number of frames is reasonable
    // (ffprobe may report various frame counts, this is a sanity check)
  }

  return failedAsserts - failuresBefore;
}

// ─────────────────────────────────────────────────────────────
// Test fixture generation
// ─────────────────────────────────────────────────────────────

const FIXTURE_SPECS = {
  'av-audio': {
    desc: 'H.264 + AAC, 320×240, 30fps, 2s',
    cmd: [
      `ffmpeg -y -v error`,
      `-f lavfi -i "testsrc2=d=2:s=320x240:r=30,format=yuv420p"`,
      `-f lavfi -i "sine=f=440:d=2"`,
      `-c:v libx264 -preset ultrafast -crf 28`,
      `-c:a aac -b:a 64k`,
      `-shortest`,
      `"${join(FIXTURES_DIR, 'av-audio.mp4')}"`,
    ].join(' '),
    output: 'av-audio.mp4',
  },
  'av-video-only': {
    desc: 'H.264 only, 320×240, 30fps, 2s',
    cmd: [
      `ffmpeg -y -v error`,
      `-f lavfi -i "testsrc2=d=2:s=320x240:r=30,format=yuv420p"`,
      `-c:v libx264 -preset ultrafast -crf 28`,
      `"${join(FIXTURES_DIR, 'av-video-only.mp4')}"`,
    ].join(' '),
    output: 'av-video-only.mp4',
  },
  'av-vertical': {
    desc: 'H.264, 1080×1920 (9:16), 30fps, 2s',
    cmd: [
      `ffmpeg -y -v error`,
      `-f lavfi -i "testsrc2=d=2:s=1080x1920:r=30,format=yuv420p"`,
      `-c:v libx264 -preset ultrafast -crf 28`,
      `"${join(FIXTURES_DIR, 'av-vertical.mp4')}"`,
    ].join(' '),
    output: 'av-vertical.mp4',
  },
  'av-60fps': {
    desc: 'H.264, 320×240, 60fps, 2s',
    cmd: [
      `ffmpeg -y -v error`,
      `-f lavfi -i "testsrc2=d=2:s=320x240:r=60,format=yuv420p"`,
      `-c:v libx264 -preset ultrafast -crf 28`,
      `"${join(FIXTURES_DIR, 'av-60fps.mp4')}"`,
    ].join(' '),
    output: 'av-60fps.mp4',
  },
  'av-long': {
    desc: 'H.264, 320×240, 30fps, 12s (for cancel test)',
    cmd: [
      `ffmpeg -y -v error`,
      `-f lavfi -i "testsrc2=d=12:s=320x240:r=30,format=yuv420p"`,
      `-c:v libx264 -preset ultrafast -crf 28`,
      `"${join(FIXTURES_DIR, 'av-long.mp4')}"`,
    ].join(' '),
    output: 'av-long.mp4',
  },
};

export function getFixtureSpec(name) {
  const spec = FIXTURE_SPECS[name];
  if (!spec) throw new Error(`Unknown fixture: ${name}`);
  return spec;
}

export function getFixturePath(name) {
  return join(FIXTURES_DIR, FIXTURE_SPECS[name].output);
}

export function ensureFixtures() {
  mkdirSync(FIXTURES_DIR, { recursive: true });

  const results = [];
  for (const [name, spec] of Object.entries(FIXTURE_SPECS)) {
    const outPath = join(FIXTURES_DIR, spec.output);
    if (existsSync(outPath) && statSync(outPath).size > 1000) {
      results.push({ name, status: 'cached', size: statSync(outPath).size });
      continue;
    }
    console.log(`  Generating fixture "${name}": ${spec.desc}`);
    try {
      execSync(spec.cmd, { encoding: 'utf-8', timeout: 30000, stdio: 'pipe' });
      const size = statSync(outPath).size;
      results.push({ name, status: 'generated', size });
    } catch (e) {
      throw new Error(`Failed to generate fixture "${name}": ${e.stderr || e.message}`);
    }
  }

  // Quick sanity: ffprobe each fixture to confirm it's valid
  for (const { name } of results) {
    const path = getFixturePath(name);
    const info = ffprobeJson(path);
    const vStream = getVideoStream(info);
    if (!vStream) {
      throw new Error(`Fixture "${name}" has no video stream — corrupt?`);
    }
  }

  return results;
}

export function cleanFixtures() {
  if (existsSync(FIXTURES_DIR)) {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  }
}

export function cleanOutput() {
  if (existsSync(OUTPUT_DIR)) {
    rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ─────────────────────────────────────────────────────────────
// HTTP server
// ─────────────────────────────────────────────────────────────

const MIME_TYPES = {
  '.html': 'text/html',
  '.js':   'text/javascript',
  '.mjs':  'text/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.json': 'application/json',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
};

export function startServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const safePath = req.url.split('?')[0].split('#')[0];
      let filePath = join(rootDir, safePath === '/' ? '/index.html' : safePath);
      const resolvedPath = resolvePath(filePath);
      const rootResolved = resolvePath(rootDir);

      if (!resolvedPath.startsWith(rootResolved)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      try {
        if (!existsSync(resolvedPath) || statSync(resolvedPath).isDirectory()) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
      } catch {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = extname(filePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const content = readFileSync(resolvedPath);
      res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
      res.end(content);
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ port, close: () => server.close() });
    });
    server.on('error', reject);
  });
}

// ─────────────────────────────────────────────────────────────
// Playwright browser
// ─────────────────────────────────────────────────────────────

export async function launchBrowser() {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error(
      'Cannot find Playwright Chromium. Run: npx playwright install chromium\n' +
      'Expected at one of:\n' +
      CHROMIUM_PATHS.map(p => '  - ' + p).join('\n')
    );
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
  });

  return browser;
}

// ─────────────────────────────────────────────────────────────
// Page interaction helpers
// ─────────────────────────────────────────────────────────────

/**
 * Navigate to app, wait for Mediabunny + OpenCV to load.
 */
export async function openApp(page, serverPort) {
  await page.goto(`http://127.0.0.1:${serverPort}/index.html`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });

  // Wait for Mediabunny
  await page.waitForFunction(() => !!window.MediaCodecs?.Output, { timeout: 30000 });
  // Wait for OpenCV
  await page.waitForFunction(() => typeof cv !== 'undefined' && !!cv.Mat, { timeout: 30000 });
}

/**
 * Upload a video file, explicitly start detection, and wait for completion.
 * Returns time taken in seconds.
 */
export async function uploadAndDetect(page, filePath) {
  const t0 = Date.now();

  await page.setInputFiles('#file-input', filePath);
  // Wait for the change handler to load the video and expose the explicit start action.
  await page.waitForFunction(() => {
    const overlay = document.getElementById('export-overlay');
    const startBtn = document.getElementById('redetect-btn');
    return overlay && overlay.classList.contains('visible') && startBtn && !startBtn.disabled;
  }, { timeout: 30000, polling: 250 });

  await page.click('#redetect-btn');

  // Wait for detection to complete (export becomes enabled).
  await page.waitForFunction(() => {
    const overlay = document.getElementById('export-overlay');
    const exportBtn = document.getElementById('export-btn');
    return overlay && overlay.classList.contains('visible') && exportBtn && !exportBtn.disabled;
  }, { timeout: 120000, polling: 1000 });

  await page.waitForTimeout(300);
  return (Date.now() - t0) / 1000;
}

/**
 * Switch codec: "h264" for MP4 or "webm" for WebM.
 */
export async function setCodec(page, codec) {
  await page.evaluate((c) => {
    const btn = document.querySelector(`#output-codec button[data-val="${c}"]`);
    if (btn) btn.click();
  }, codec);
  await page.waitForTimeout(200);
}

/**
 * Switch output FPS: "source", "30", or "60".
 */
export async function setOutputFps(page, fps) {
  await page.evaluate((f) => {
    const btn = document.querySelector(`#output-fps button[data-val="${f}"]`);
    if (btn) btn.click();
  }, fps);
  // Changing FPS triggers re-detect; wait for it
  await page.waitForTimeout(500);
  await page.waitForFunction(() => {
    const overlay = document.getElementById('export-overlay');
    return overlay && overlay.classList.contains('visible');
  }, { timeout: 60000, polling: 1000 });
}

/**
 * Get detected source FPS from the page.
 */
export async function getSourceFps(page) {
  return await page.evaluate(() => window.sourceFps || null);
}

/**
 * Start export and wait for download.
 * Returns { filePath, suggestedName, sizeBytes }.
 */
export async function startExportAndDownload(page, timeoutMs = 60000) {
  const downloadPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Export download timed out')), timeoutMs);
    page.on('download', (download) => {
      clearTimeout(timer);
      resolve(download);
    });
  });

  await page.click('#export-btn');

  const download = await downloadPromise;
  const dlPath = await download.path();
  const suggestedName = download.suggestedFilename();

  return {
    filePath: dlPath,
    suggestedName,
    sizeBytes: statSync(dlPath).size,
  };
}

/**
 * Start export and cancel.
 * Clicks export to start, waits briefly, clicks again to cancel.
 * Awaits the UI to reflect cancellation (button back to "Export").
 * Returns the post-cancel page state.
 */
export async function startExportAndCancel(page) {
  // Start export
  await page.click('#export-btn');
  await page.waitForTimeout(2000); // Let some frames encode

  // Click the same button again to cancel (it now shows "Stop")
  await page.click('#export-btn');

  // Wait for export to actually cancel and button to revert
  await page.waitForFunction(() => {
    const btn = document.getElementById('export-btn');
    if (!btn) return false;
    const text = btn.textContent.trim();
    return text === '⬇ Export' || text === 'Export' || text === 'Download';
  }, { timeout: 30000, polling: 500 });

  // Extra settle time
  await page.waitForTimeout(500);

  // Check state
  const state = await page.evaluate(() => ({
    isExporting: window.isExporting,
    exportBtnText: document.getElementById('export-btn')?.textContent?.trim(),
    isExporting_raw: window.isExporting,
  }));

  return state;
}

/**
 * Collect console messages and page errors for a given page session.
 */
export function getPageLogs(page) {
  return {
    messages: page._consoleMsgs || [],
    errors: page._pageErrors || [],
  };
}

/**
 * Set up console/error listeners on a page.
 * Call BEFORE navigation.
 */
export function setupPageLogging(page) {
  page._consoleMsgs = [];
  page._pageErrors = [];

  page.on('console', msg => {
    page._consoleMsgs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    page._pageErrors.push(err.message);
  });
}

/**
 * Check for AudioSample leak warnings in console messages.
 */
export function checkAudioSampleLeaks(messages) {
  const leaks = messages.filter(m =>
    m.includes('AudioSample') && m.includes('garbage collected'));
  return leaks;
}
