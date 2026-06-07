// Deeper smoke test: exercise the export helpers in isolation.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext().then(c => c.newPage());

  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Test pickWebmMime (synchronous, works without WebCodecs).
  const webm = await page.evaluate(() => {
    try { return pickWebmMime(); } catch (e) { return 'ERROR: ' + e.message; }
  });
  console.log('pickWebmMime() =', webm);

  // Test that pickH264Codec handles missing WebCodecs gracefully.
  const h264 = await page.evaluate(async () => {
    if (typeof VideoEncoder === 'undefined') return 'VideoEncoder undefined (expected in this browser)';
    try { return await pickH264Codec(1920, 1080, 30, 8_000_000); }
    catch (e) { return 'ERROR: ' + e.message; }
  });
  console.log('pickH264Codec(1080p) =', h264);

  // Test renderToTarget with a fake 2x2 video and some blobs.
  const renderResult = await page.evaluate(() => {
    try {
      // Fake a video element by creating a 4x3 canvas and a synthetic blob.
      const fakeW = 4, fakeH = 3;
      video.videoWidth = fakeW;
      video.videoHeight = fakeH;
      const canvas = document.createElement('canvas');
      canvas.width = 1920; canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      // Make the drawImage call harmless by providing a 1x1 transparent source.
      const tiny = document.createElement('canvas');
      tiny.width = fakeW; tiny.height = fakeH;
      const tctx = tiny.getContext('2d');
      tctx.fillStyle = '#888'; tctx.fillRect(0, 0, fakeW, fakeH);
      // Monkey-patch video to return our tiny canvas.
      Object.defineProperty(video, 'videoWidth', { configurable: true, value: fakeW });
      Object.defineProperty(video, 'videoHeight', { configurable: true, value: fakeH });
      // Replace drawImage for the video with a custom path: we already drew on tiny.
      // renderToTarget calls ctx.drawImage(video, ...). Provide a stub.
      // Simpler: assign a getter that returns the tiny canvas.
      // Note: ctx.drawImage accepts a Canvas as the source. So just attach the canvas as a property.
      Object.defineProperty(video, '__fakeSource', { value: tiny });
      // Override drawImage: easier to just re-bind using a Proxy. Simpler: monkey-patch HTMLVideoElement.drawImage on the context, but that's not easy.
      // Instead, override the video element to behave like a canvas via a Proxy.
      const origDraw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (src, ...args) {
        if (src === video) return origDraw.call(this, tiny, ...args);
        return origDraw.apply(this, [src, ...args]);
      };
      try {
        renderToTarget(ctx, [{ x: 2, y: 1, area: 1, bx: 1, by: 0, bw: 2, bh: 2, pts: [{x:2,y:1}], id: 0 }], 1920, 1080);
      } finally {
        CanvasRenderingContext2D.prototype.drawImage = origDraw;
      }
      return { ok: true, w: canvas.width, h: canvas.height };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
  console.log('renderToTarget test:', JSON.stringify(renderResult));

  // Test TrailBuffer push+draw.
  const trailResult = await page.evaluate(() => {
    try {
      const c = document.createElement('canvas');
      c.width = 100; c.height = 100;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f00'; ctx.fillRect(0, 0, 100, 100);
      TrailBuffer.setCapacity(3);
      TrailBuffer.push(c);
      TrailBuffer.push(c);
      TrailBuffer.push(c);
      // Draw onto a target.
      const target = document.createElement('canvas');
      target.width = 100; target.height = 100;
      const tctx = target.getContext('2d');
      TrailBuffer.draw(tctx, 0.5);
      return { ok: true, capacity: TrailBuffer.capacity };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
  console.log('TrailBuffer test:', JSON.stringify(trailResult));

  // Test computeExportSize.
  const sizes = await page.evaluate(() => {
    // Fake video dimensions.
    Object.defineProperty(video, 'videoWidth', { configurable: true, value: 1920 });
    Object.defineProperty(video, 'videoHeight', { configurable: true, value: 1080 });
    P.outputSize = 'preview'; const a = computeExportSize();
    P.outputSize = '1080p';   const b = computeExportSize();
    P.outputSize = '1080x1920'; const c = computeExportSize();
    // Portrait source.
    Object.defineProperty(video, 'videoWidth', { configurable: true, value: 1080 });
    Object.defineProperty(video, 'videoHeight', { configurable: true, value: 1920 });
    P.outputSize = '1080p';   const d = computeExportSize();
    return { landscapePreview: a, landscape1080p: b, fixed916: c, portrait1080p: d };
  });
  console.log('computeExportSize:', JSON.stringify(sizes));

  // Test pickH264Codec with a stubbed VideoEncoder (returns true for first config).
  const probe = await page.evaluate(async () => {
    // Save original
    const origVE = globalThis.VideoEncoder;
    let probes = [];
    const stub = class {
      static isConfigSupported(cfg) {
        probes.push(cfg.codec);
        // Pretend avc1.640028 is supported.
        return Promise.resolve({ supported: cfg.codec === 'avc1.640028', config: cfg });
      }
    };
    globalThis.VideoEncoder = stub;
    try {
      P.outputSize = '1080p';
      const a = await pickH264Codec(1920, 1080, 30, 8_000_000);
      P.outputSize = 'preview';
      const b = await pickH264Codec(540, 405, 30, 2_000_000);
      return { high: a, low: b, probes };
    } finally {
      globalThis.VideoEncoder = origVE;
    }
  });
  console.log('pickH264Codec stubbed:', JSON.stringify(probe));

  await browser.close();
})();
