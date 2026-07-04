#!/usr/bin/env node
// run-online-tests.mjs
// Entry point for the online-version test suite.
//
// Usage:
//   node tests/js/run-online-tests.mjs              # run all scenarios
//   node tests/js/run-online-tests.mjs --scenario 1  # run 1 specific scenario
//   node tests/js/run-online-tests.mjs --skip-scenario 1  # skip CI-unstable scenarios
//   node tests/js/run-online-tests.mjs --keep-output # don't clean output dir
//
// Exit code: 0 = all passed, 1 = any scenario failed

import {
  startServer, launchBrowser,
  ensureFixtures, cleanFixtures, cleanOutput,
  ONLINE_DIR, OUTPUT_DIR,
} from './online-test-harness.mjs';

import {
  testMp4Audio,
  testWebmAudio,
  testMp4VideoOnly,
  testWebmVideoOnly,
  testVerticalVideo,
  test60fps,
  testCancelExport,
} from './online-test-scenarios.mjs';

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const ALL_SCENARIOS = [
  { id: 1, name: 'MP4 + AAC',            fn: testMp4Audio },
  { id: 2, name: 'WebM + AAC',           fn: testWebmAudio },
  { id: 3, name: 'MP4 video-only',       fn: testMp4VideoOnly },
  { id: 4, name: 'WebM video-only',      fn: testWebmVideoOnly },
  { id: 5, name: 'Vertical source size', fn: testVerticalVideo },
  { id: 6, name: '60 FPS → Source',      fn: test60fps },
  { id: 7, name: 'Cancel export',        fn: testCancelExport },
];

// Parse args
const args = process.argv.slice(2);
let scenarioFilter = null;
let keepOutput = false;
const skippedScenarios = new Set(
  (process.env.BLOB_TRACKER_SKIP_SCENARIOS || '')
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(Number.isFinite)
);

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--scenario' || args[i] === '-s') {
    scenarioFilter = parseInt(args[++i], 10);
  }
  if (args[i] === '--skip-scenario' || args[i] === '--skip') {
    for (const id of String(args[++i] || '').split(',')) {
      const parsed = parseInt(id.trim(), 10);
      if (Number.isFinite(parsed)) skippedScenarios.add(parsed);
    }
  }
  if (args[i] === '--keep-output') {
    keepOutput = true;
  }
}

const scenariosToRun = scenarioFilter
  ? ALL_SCENARIOS.filter(s => s.id === scenarioFilter && !skippedScenarios.has(s.id))
  : ALL_SCENARIOS.filter(s => !skippedScenarios.has(s.id));

if (scenarioFilter && scenariosToRun.length === 0) {
  console.error(`Unknown scenario: ${scenarioFilter}. Valid IDs: ${ALL_SCENARIOS.map(s => s.id).join(', ')}`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   online-version Test Suite              ║');
  console.log('╚══════════════════════════════════════════╝\n');
  console.log(`Scenarios: ${scenariosToRun.length} (${scenariosToRun.map(s => s.id).join(', ')})`);
  if (skippedScenarios.size) {
    console.log(`Skipped:   ${Array.from(skippedScenarios).sort((a, b) => a - b).join(', ')}`);
  }
  console.log(`Fixtures:  ${ONLINE_DIR}/fixtures/`);
  console.log(`Output:    ${OUTPUT_DIR}/\n`);

  // Step 1: Generate test fixtures
  console.log('─── Generating test fixtures ───');
  const fixtureResults = ensureFixtures();
  for (const f of fixtureResults) {
    console.log(`  ${f.status === 'cached' ? '♻' : '✓'} ${f.name}: ${(f.size / 1024).toFixed(1)} KB`);
  }

  // Step 2: Start server
  console.log('\n─── Starting server ───');
  const server = await startServer(ONLINE_DIR);
  console.log(`  Server: http://127.0.0.1:${server.port}`);

  // Step 3: Launch browser
  console.log('\n─── Launching browser ───');
  const browser = await launchBrowser();
  console.log('  Browser: Chromium (headless)');

  // Step 4: Clean output
  if (!keepOutput) {
    cleanOutput();
  }

  // Step 5: Run scenarios
  console.log('\n─── Running scenarios ───');
  const results = [];
  let anyFailed = false;

  for (const scenario of scenariosToRun) {
    const startTime = Date.now();
    try {
      const result = await scenario.fn({ browser, port: server.port });
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const passed = result.failed === 0;

      console.log(`\n  ── ${result.name} ── ${passed ? '✅ PASS' : '❌ FAIL'} (${elapsed}s)`);
      console.log(`     Assertions: ${result.total} total, ${result.failed} failed`);

      results.push({ ...result, passed, elapsed: parseFloat(elapsed) });
      if (!passed) anyFailed = true;
    } catch (e) {
      console.error(`\n  ── ${scenario.name} ── 💥 CRASH`);
      console.error(`     ${e.message}`);
      console.error(e.stack?.split('\n').slice(0, 4).join('\n     ') || '');
      results.push({ name: scenario.name, passed: false, crashed: true, error: e.message });
      anyFailed = true;
    }
    console.log('');
  }

  // Step 6: Summary
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   SUMMARY                                ║');
  console.log('╚══════════════════════════════════════════╝\n');

  let totalAssertions = 0;
  let failedAssertions = 0;

  for (const r of results) {
    const icon = r.crashed ? '💥' : r.passed ? '✅' : '❌';
    console.log(`  ${icon} ${r.name}`);
    if (r.crashed) {
      console.log(`       CRASHED: ${r.error}`);
    } else {
      console.log(`       ${r.total} assertions, ${r.failed} failed, ${r.elapsed?.toFixed(1)}s`);
      totalAssertions += r.total;
      failedAssertions += r.failed;
    }
  }

  console.log(`\n  Total: ${results.length} scenarios, ${totalAssertions} assertions, ${failedAssertions} failed`);

  if (anyFailed) {
    console.log('\n  ❌ SOME SCENARIOS FAILED\n');
  } else {
    console.log('\n  ✅ ALL SCENARIOS PASSED\n');
  }

  // Cleanup
  await browser.close();
  server.close();

  process.exit(anyFailed ? 1 : 0);
}

main().catch(e => {
  console.error('\n💥 Fatal error:', e.message);
  console.error(e.stack);
  process.exit(1);
});
