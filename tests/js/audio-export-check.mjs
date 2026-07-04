// audio-export-check.mjs
// Minimal automated check: verify Mediabunny audio export end-to-end.
//   - Opens online-version/index.html in headless Chromium
//   - Uploads H.264 + AAC test video
//   - Detects blobs, exports MP4 with audio
//   - Validates output with ffprobe
//
// Requires: npm install (playwright, mediabunny already in node_modules)
// Requires: local HTTP server (started automatically on a random port)
//
// Usage:
//   node tests/js/audio-export-check.mjs
//   echo $?   → 0 = pass, 1 = fail

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));
const INPUT_MP4 = join(__dir, 'input.mp4');
const ONLINE_DIR = join(__dir, '..', '..', 'online-version');

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

function assert(cond, msg) {
  if (cond) {
    console.log('  OK:', msg);
  } else {
    console.error('  FAIL:', msg);
    process.exitCode = 1;
  }
}

function ffprobeJson(filePath) {
  const out = execSync(
    `ffprobe -v quiet -print_format json -show_streams -show_format "${filePath}"`,
    { encoding: 'utf-8', timeout: 15000 },
  );
  return JSON.parse(out);
}

function ffmpegDecode(filePath) {
  execSync(
    `ffmpeg -v error -i "${filePath}" -f null -`,
    { encoding: 'utf-8', timeout: 30000 },
  );
}

// ─────────────────────────────────────────────────────────────
// Simple static HTTP server
// ─────────────────────────────────────────────────────────────

function startServer(rootDir) {
  return new Promise((resolve, reject) => {
    const mimeTypes = {
      '.html': 'text/html',
      '.js':   'text/javascript',
      '.mjs':  'text/javascript',
      '.css':  'text/css',
      '.png':  'image/png',
      '.svg':  'image/svg+xml',
      '.json': 'application/json',
      '.mp4':  'video/mp4',
    };

    const server = createServer((req, res) => {
      const safePath = req.url.split('?')[0].split('#')[0];
      let filePath = join(rootDir, safePath === '/' ? '/index.html' : safePath);

      // Security: ensure resolved path is inside rootDir
      const resolved = join(filePath);
      if (!resolved.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      try {
        if (!existsSync(resolved) || statSync(resolved).isDirectory()) {
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
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      const content = readFileSync(resolved);

      res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
      res.end(content);
    });

    // Listen on a random port
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      console.log(`  Server started on http://127.0.0.1:${port}`);
      resolve({ port, close: () => server.close() });
    });
    server.on('error', reject);
  });
}

// ─────────────────────────────────────────────────────────────
// Main test
// ─────────────────────────────────────────────────────────────

async function main() {
  // Validate prerequisites
  if (!existsSync(INPUT_MP4)) fail('input.mp4 not found at ' + INPUT_MP4);
  if (!existsSync(join(ONLINE_DIR, 'index.html'))) fail('online-version/index.html not found');

  console.log('=== Audio Export Check ===\n');
  console.log('Fixture:', INPUT_MP4, `(${(statSync(INPUT_MP4).size / 1024).toFixed(1)} KB)`);

  // Start server
  const server = await startServer(ONLINE_DIR);
  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      // Use full Chrome binary since headless shell download failed
      executablePath: 'C:\\Users\\1234\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe',
    });
    const ctx = await browser.newContext({ acceptDownloads: true });
    const page = await ctx.newPage();

    // Collect logs and errors
    const consoleMsgs = [];
    const pageErrors = [];
    page.on('console', msg => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => pageErrors.push(err.message));

    // Handle download
    const downloadPromise = new Promise((resolve, reject) => {
      page.on('download', resolve);
      // Timeout if download doesn't start
      setTimeout(() => reject(new Error('Download timeout')), 60000);
    });

    // Navigate
    console.log('\n1. Loading online-version/index.html…');
    await page.goto(`http://127.0.0.1:${server.port}/index.html`, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
    console.log('   Page loaded (DOM + network idle)');

    // Wait for Mediabunny to initialize
    console.log('2. Waiting for Mediabunny to load…');
    await page.waitForFunction(() => !!window.MediaCodecs?.Output, undefined, { timeout: 20000 });
    // Wait for OpenCV too
    await page.waitForFunction(() => typeof cv !== 'undefined' && !!cv.Mat, undefined, { timeout: 20000 });
    console.log('   Mediabunny + OpenCV loaded');

    // Upload the test video
    console.log('3. Uploading input.mp4…');
    await page.setInputFiles('#file-input', INPUT_MP4);
    // Wait a tick for the change handler
    await page.waitForTimeout(500);

    // Wait for detection to complete: export overlay becomes visible (class="visible")
    console.log('4. Waiting for blob detection to complete…');
    // Poll state for debugging
    const detectStart = Date.now();
    try {
      await page.waitForFunction(() => {
        const overlay = document.getElementById('export-overlay');
        return overlay && overlay.classList.contains('visible');
      }, undefined, { timeout: 120000, polling: 1000 });
    } catch (e) {
      // Debug: dump current state
      const state = await page.evaluate(() => ({
        overlayClasses: document.getElementById('export-overlay')?.className,
        overlayInlineDisplay: document.getElementById('export-overlay')?.style?.display,
        isProcessing: window.isProcessing,
        isExporting: window.isExporting,
        allFrameDataLen: window.all_frame_data?.length,
        videoReady: !!(window.video?.src),
        videoDuration: window.video?.duration,
        progressLabel: document.getElementById('progress-label')?.textContent,
      }));
      console.error('   Detection state after', (Date.now() - detectStart)/1000, 's:', JSON.stringify(state, null, 2));
      fail('Detection timed out — see state above');
    }
    console.log('   Detection complete after', ((Date.now() - detectStart)/1000).toFixed(1) + 's');

    // Small pause to let detection results render
    await page.waitForTimeout(500);

    // Start export
    console.log('5. Starting MP4 export…');
    await page.click('#export-btn');

    // Wait for download
    console.log('6. Waiting for download…');
    const download = await downloadPromise;
    const dlPath = await download.path();
    const suggestedName = download.suggestedFilename();
    console.log(`   Downloaded as "${suggestedName}" (${(statSync(dlPath).size / 1024).toFixed(1)} KB)`);

    // ─── Verify output with ffprobe ──────────────────────
    console.log('\n7. Verifying output with ffprobe…');

    const info = ffprobeJson(dlPath);

    // a) Video track
    const videoStreams = info.streams.filter(s => s.codec_type === 'video');
    assert(videoStreams.length >= 1,
      `MP4 has ≥1 video stream (got ${videoStreams.length})`);

    // b) Audio track present
    const audioStreams = info.streams.filter(s => s.codec_type === 'audio');
    assert(audioStreams.length === 1,
      `MP4 has 1 audio stream (got ${audioStreams.length})`);

    // c) Audio codec is AAC
    assert(audioStreams[0].codec_name === 'aac',
      `Audio codec is AAC (got ${audioStreams[0].codec_name})`);

    // d) Duration within tolerance (±1 frame at 30fps ≈ 0.050s)
    const expectedDur = 2.0;
    const actualDur = parseFloat(info.format.duration);
    const tolerance = 0.05;
    assert(Math.abs(actualDur - expectedDur) < tolerance,
      `Duration ${actualDur}s ≈ ${expectedDur}s (±${tolerance}s)`);

    // e) Full decode without errors
    try {
      ffmpegDecode(dlPath);
      assert(true, 'Full decode passed');
    } catch (e) {
      assert(false, 'Full decode failed: ' + e.message);
    }

    // ─── Check for AudioSample leaks in console ──────
    const leakWarnings = consoleMsgs.filter(m =>
      m.includes('AudioSample') && m.includes('garbage collected'));
    assert(leakWarnings.length === 0,
      `No AudioSample leak warnings (${leakWarnings.length})`);

    // ─── Check for errors ────────────────────────────
    if (pageErrors.length > 0) {
      console.error('\n  Page errors detected:');
      for (const e of pageErrors) console.error('    -', e);
      process.exitCode = 1;
    } else {
      console.log('  OK: No page errors');
    }

    console.log('\n=== RESULT: ' + (process.exitCode ? 'FAILED' : 'PASSED') + ' ===');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

main().catch(e => {
  console.error('Test crashed:', e.message);
  console.error(e.stack);
  process.exit(1);
});
