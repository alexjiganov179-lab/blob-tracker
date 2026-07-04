#!/usr/bin/env node
// test-opencv-fallback.mjs
// Focused test for the OpenCV CDN fallback + retry mechanism.
//
// Verifies three behaviors:
//   1. Primary CDN blocked  -> falls back to secondary CDN and still loads cv.
//   2. All CDNs blocked      -> error UI (title + body + Retry button) appears.
//   3. Retry after unblock   -> clicking Retry loads cv from a now-available CDN.
//
// Usage:
//   node tests/js/test-opencv-fallback.mjs
//
// Exit code: 0 = all passed, 1 = any failed.

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolvePath(__dir, '..', '..');
const ONLINE_DIR = join(ROOT_DIR, 'online-version');

const CHROMIUM_PATHS = [
  join('C:', 'Users', '1234', 'AppData', 'Local', 'ms-playwright',
       'chromium-1228', 'chrome-win64', 'chrome.exe'),
  join('C:', 'Users', '1234', 'AppData', 'Local', 'ms-playwright',
       'chromium-1224', 'chrome-win64', 'chrome.exe'),
];

function findChrome() {
  for (const p of CHROMIUM_PATHS) if (existsSync(p)) return p;
  return null;
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json',
};

function startServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const safePath = req.url.split('?')[0].split('#')[0];
      const filePath = join(rootDir, safePath === '/' ? '/index.html' : safePath);
      const resolved = resolvePath(filePath);
      const root = resolvePath(rootDir);
      if (!resolved.startsWith(root)) { res.writeHead(403); res.end('Forbidden'); return; }
      if (!existsSync(resolved) || statSync(resolved).isDirectory()) {
        res.writeHead(404); res.end('Not found'); return;
      }
      const ct = MIME[extname(filePath)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': ct });
      res.end(readFileSync(resolved));
    });
    server.listen(0, '127.0.0.1', () => resolve({ port: server.address().port, close: () => server.close() }));
    server.on('error', reject);
  });
}

// ── assertion helpers ────────────────────────────────────────
let total = 0, failed = 0;
function assert(cond, msg) {
  total++;
  if (cond) { console.log('  \u2705', msg); }
  else { console.error('  \u274C', msg); failed++; }
}

const OPENCV_HOSTS = ['docs.opencv.org', 'cdn.jsdelivr.net', 'unpkg.com'];

// ── Test 1: primary blocked -> fallback succeeds ─────────────
async function testFallbackOnPrimaryBlocked(browser, port) {
  console.log('\n\u2550\u2550\u2550 Test 1: primary CDN blocked \u2192 fallback loads cv \u2550\u2550\u2550');
  const page = await browser.newPage();
  const consoleMsgs = [];
  page.on('console', m => consoleMsgs.push(`[${m.type()}] ${m.text()}`));

  // Block only the primary OpenCV host
  await page.route('**/*docs.opencv.org*/**', r => r.abort());
  // Allow everything else

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // cv must eventually become available via a fallback CDN
  await page.waitForFunction(() => typeof cv !== 'undefined' && !!cv.Mat, { timeout: 90000 });

  const status = await page.evaluate(() => window.__openCvStatus);
  const cvState = await page.evaluate(() => ({
    defined: typeof cv !== 'undefined',
    hasMat: typeof cv !== 'undefined' && !!cv.Mat,
  }));
  assert(cvState.defined === true, 'cv is defined after primary blocked');
  assert(cvState.hasMat === true, 'cv.Mat is available after primary blocked');
  assert(status.ready === true, '__openCvStatus.ready is true');
  assert(status.failed === false, '__openCvStatus.failed is false');
  assert(status.url && status.url.includes('jsdelivr.net'),
    `Loaded from jsdelivr fallback (got: ${status.url || '?'})`);
  assert(status.attempt >= 2, `Took >= 2 attempts (got: ${status.attempt})`);

  // Loading screen should be hidden once app is also ready
  // (app.js hideLoad needs both cvReady and appReady)
  await page.waitForFunction(() => {
    const el = document.getElementById('loading-screen');
    return !el || el.style.display === 'none';
  }, { timeout: 15000 });
  assert(true, 'Loading screen hidden after successful fallback');

  await page.close();
  return consoleMsgs;
}

// ── Test 2: all CDNs blocked -> error UI ─────────────────────
async function testAllBlockedShowsError(browser, port) {
  console.log('\n\u2550\u2550\u2550 Test 2: all CDNs blocked \u2192 error UI shown \u2550\u2550\u2550');
  const page = await browser.newPage();
  const consoleMsgs = [];
  page.on('console', m => consoleMsgs.push(`[${m.type()}] ${m.text()}`));

  // Block every OpenCV host
  for (const host of OPENCV_HOSTS) {
    await page.route(`**/*${host}/**`, r => r.abort());
  }

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for error UI to appear
  await page.waitForSelector('#opencv-load-error', { state: 'visible', timeout: 30000 });

  const state = await page.evaluate(() => {
    const errBox = document.getElementById('opencv-load-error');
    const title = document.getElementById('opencv-load-error-title');
    const body = document.getElementById('opencv-load-error-body');
    const retry = document.getElementById('opencv-retry-btn');
    const spinner = document.getElementById('loading-spinner');
    const loadingText = document.getElementById('loading-text');
    return {
      errVisible: errBox && errBox.style.display !== 'none',
      titleText: title ? title.textContent.trim() : '',
      bodyText: body ? body.textContent.trim() : '',
      retryVisible: retry && retry.offsetParent !== null,
      spinnerHidden: spinner && spinner.style.display === 'none',
      loadingTextHidden: loadingText && loadingText.style.display === 'none',
      status: window.__openCvStatus,
      cvReady: window.__openCvReady,
      cvError: window.__openCvError,
    };
  });

  assert(state.errVisible === true, 'Error box is visible');
  assert(state.spinnerHidden === true, 'Spinner is hidden when error shown');
  assert(state.loadingTextHidden === true, 'Loading text is hidden when error shown');
  assert(state.titleText.length > 0, `Error title has text: "${state.titleText}"`);
  assert(state.bodyText.length > 0, `Error body has text: "${state.bodyText}"`);
  assert(state.retryVisible === true, 'Retry button is visible');
  assert(state.cvReady !== true, '__openCvReady is not true');
  assert(state.cvError === true, '__openCvError is true');
  assert(state.status.failed === true, '__openCvStatus.failed is true');
  assert(state.status.attempt === 3, `All 3 CDNs attempted (got: ${state.status.attempt})`);

  // Loading screen must stay visible (so user can see + click retry)
  const loadingScreen = await page.evaluate(() => {
    const el = document.getElementById('loading-screen');
    return el ? el.style.display : 'missing';
  });
  assert(loadingScreen !== 'none', 'Loading screen stays visible during error');

  await page.close();
  return consoleMsgs;
}

// ── Test 3: retry after unblock loads cv ─────────────────────
async function testRetryRecovers(browser, port) {
  console.log('\n\u2550\u2550\u2550 Test 3: retry after unblock \u2192 cv loads \u2550\u2550\u2550');
  const page = await browser.newPage();
  const consoleMsgs = [];
  page.on('console', m => consoleMsgs.push(`[${m.type()}] ${m.text()}`));

  // Start with all CDNs blocked
  for (const host of OPENCV_HOSTS) {
    await page.route(`**/*${host}/**`, r => r.abort());
  }

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#opencv-load-error', { state: 'visible', timeout: 30000 });

  // Now unblock the primary CDN by clearing routes
  await page.unroute('**/*docs.opencv.org/**');

  // Click retry
  await page.click('#opencv-retry-btn');

  // cv must load from primary after unblock
  await page.waitForFunction(() => typeof cv !== 'undefined' && !!cv.Mat, { timeout: 90000 });

  const status = await page.evaluate(() => window.__openCvStatus);
  const cvState = await page.evaluate(() => ({
    defined: typeof cv !== 'undefined',
    hasMat: typeof cv !== 'undefined' && !!cv.Mat,
  }));
  assert(cvState.defined === true, 'cv is defined after retry');
  assert(cvState.hasMat === true, 'cv.Mat is available after retry');
  assert(status.ready === true, '__openCvStatus.ready is true after retry');
  assert(status.failed === false, '__openCvStatus.failed is false after retry');
  assert(status.url && status.url.includes('docs.opencv.org'),
    `Retry loaded from primary (got: ${status.url || '?'})`);

  // Error box should be hidden again
  const errVisible = await page.evaluate(() => {
    const el = document.getElementById('opencv-load-error');
    return el ? el.style.display !== 'none' : false;
  });
  assert(errVisible === false, 'Error box is hidden after successful retry');

  await page.close();
  return consoleMsgs;
}

// ── main ─────────────────────────────────────────────────────
async function main() {
  console.log('\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  console.log('\u2551   OpenCV Fallback / Retry Test Suite        \u2551');
  console.log('\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n');

  const chromePath = findChrome();
  if (!chromePath) {
    console.error('Cannot find Playwright Chromium.');
    process.exit(1);
  }

  const server = await startServer(ONLINE_DIR);
  console.log(`Server: http://127.0.0.1:${server.port}`);

  const browser = await chromium.launch({ headless: true, executablePath: chromePath });

  const tests = [
    { name: 'Fallback on primary blocked', fn: () => testFallbackOnPrimaryBlocked(browser, server.port) },
    { name: 'All CDNs blocked shows error', fn: () => testAllBlockedShowsError(browser, server.port) },
    { name: 'Retry recovers after unblock',  fn: () => testRetryRecovers(browser, server.port) },
  ];

  for (const t of tests) {
    const t0 = Date.now();
    try {
      await t.fn();
      console.log(`\n  \u2500\u2500 ${t.name} \u2500\u2500 \u2705 PASS (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
    } catch (e) {
      failed++;
      console.log(`\n  \u2500\u2500 ${t.name} \u2500\u2500 \u274C FAIL (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      console.error('     ' + (e.message || e));
      if (e.stack) console.error('     ' + e.stack.split('\n').slice(0, 3).join('\n     '));
    }
  }

  await browser.close();
  server.close();

  console.log('\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  console.log('\u2551   SUMMARY                                    \u2551');
  console.log('\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n');
  console.log(`  ${failed === 0 ? '\u2705 ALL PASSED' : '\u274C ' + failed + ' FAILED'}  (${total} assertions)`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
