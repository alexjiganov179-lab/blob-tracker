// ============================
// EXPORT PIPELINE
// ============================

function computeExportSize() {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return { w: canvas.width, h: canvas.height };
  return { w: vw, h: vh };
}

function computeBitrate(w, h) {
  const px = w * h;
  return Math.max(2_000_000, Math.round(px * 4.5));
}

function renderToTarget(ctx, blobs, targetW, targetH) {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, targetW, targetH);
    return;
  }
  const scale = Math.min(targetW / vw, targetH / vh);
  const drawW = vw * scale, drawH = vh * scale;
  const offX = (targetW - drawW) / 2;
  const offY = (targetH - drawH) / 2;

  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(video, offX, offY, drawW, drawH);
  ctx.restore();

  if (!blobs || !blobs.length) return;
  const sx = drawW / canvas.width;
  const sy = drawH / canvas.height;
  const scaled = blobs.map(b => ({
    ...b,
    x: b.x * sx + offX, y: b.y * sy + offY,
    bx: b.bx * sx + offX, by: b.by * sy + offY,
    bw: b.bw * sx, bh: b.bh * sy,
    pts: b.pts ? b.pts.map(p => ({ x: p.x * sx + offX, y: p.y * sy + offY })) : b.pts,
  }));

  drawEffectLayer(ctx, scaled);
  drawLinesLayer(ctx, scaled);
  drawCentroidDots(ctx, scaled);
  drawLabelsLayer(ctx, scaled);
  drawPostFx(ctx, targetW, targetH);
}

function renderCurrentPreviewFrame() {
  if (typeof window.renderCurrentFrame === "function") {
    window.renderCurrentFrame();
    return;
  }
  if (!video || video.readyState < 2) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const { prev, next } = findBracketingFrames(video.currentTime);
  const blobs = interpolateBlobs(prev, next, video.currentTime);
  drawEffectLayer(ctx, blobs);
  drawLinesLayer(ctx, blobs);
  drawCentroidDots(ctx, blobs);
  drawLabelsLayer(ctx, blobs);
  drawPostFx(ctx, canvas.width, canvas.height);
}

function capturePlaybackState() {
  return {
    time: Number.isFinite(video.currentTime) ? video.currentTime : 0,
    wasPaused: video.paused,
    loop: video.loop,
  };
}

async function restorePlaybackState(state) {
  if (!state || !video || video.readyState < 2) return;
  const dur = Number.isFinite(video.duration) ? video.duration : 0;
  const maxTime = dur > 0.05 ? dur - 0.05 : dur;
  const restoreTime = Math.min(Math.max(0, state.time), Math.max(0, maxTime));
  try {
    video.loop = state.loop;
    await seekTo(restoreTime);
    renderCurrentPreviewFrame();
    if (state.wasPaused) {
      video.pause();
    } else {
      await video.play().catch(e => log("export", "Playback restore play failed", { error: e.message }));
    }
    log("export", "Playback restored after export", { time: restoreTime, wasPaused: state.wasPaused });
  } catch (e) {
    log("export", "Playback restore failed", { error: e.message });
  }
}

async function pickH264Codec(width, height, framerate, bitrate) {
  const preferHigh = width * height >= 1280 * 720;
  const candidates = preferHigh
    ? ["avc1.640028", "avc1.4D4028", "avc1.42001F", "avc1.42E01F"]
    : ["avc1.42001F", "avc1.42E01F", "avc1.640028"];
  for (const codec of candidates) {
    try {
      const r = await VideoEncoder.isConfigSupported({ codec, width, height, bitrate, framerate });
      if (r && r.supported) return codec;
    } catch (e) {}
  }
  return null;
}

function pickWebmMime() {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const m of candidates) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {}
  }
  return "video/webm";
}

function startExportUiBusy(label) {
  isExporting = true;
  exportBtn.disabled = true;
  exportBtn.textContent = "⏹ Stop";
  progressBar.classList.add("visible");
  hideCancelDetect();
  showCancelExport();
  if (cancelExportBtn) cancelExportBtn.disabled = false;
  progressLabel.textContent = label;
  progressFill.style.width = "0%";
}

function endExportUi(label) {
  isExporting = false;
  exportBtn.disabled = false;
  exportBtn.textContent = "⬇ Export";
  hideCancelExport();
  if (label) {
    progressLabel.textContent = label;
    setTimeout(() => progressBar.classList.remove("visible"), 1500);
  } else {
    progressBar.classList.remove("visible");
  }
}

async function runWebCodecsExport() {
  if (!window.MP4Muxer) throw new Error("MP4 muxer not loaded");
  if (typeof VideoEncoder === "undefined") throw new Error("WebCodecs is not available in this browser");

  const { w: ew, h: eh } = computeExportSize();
  const fps = getEffectiveFps();
  const dur = video.duration;
  const totalFrames = Math.max(1, Math.ceil(dur * fps));
  const bitrate = computeBitrate(ew, eh);

  const codec = await pickH264Codec(ew, eh, fps, bitrate);
  if (!codec) throw new Error("No supported H.264 configuration");
  log("export", "WebCodecs codec selected", { codec, ew, eh, fps, bitrate });

  exportCanvas.width = ew;
  exportCanvas.height = eh;

  const muxer = new window.MP4Muxer.Muxer({
    target: new window.MP4Muxer.ArrayBufferTarget(),
    video: { codec: "avc", width: ew, height: eh },
    firstTimestampBehavior: "offset",
    fastStart: "in-memory",
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: e => log("export", "Encoder error", { error: e.message }),
  });

  await encoder.configure({ codec, width: ew, height: eh, bitrate, framerate: fps });
  video.pause();

  let cancelled = false;
  for (let i = 0; i < totalFrames; i++) {
    if (!isExporting) { cancelled = true; break; }
    const targetTime = i / fps;
    await seekTo(targetTime);

    const time = video.currentTime;
    const { prev, next } = findBracketingFrames(time);
    const blobs = interpolateBlobs(prev, next, time);
    renderToTarget(exportCtx, blobs, ew, eh);

    const frame = new VideoFrame(exportCanvas, { timestamp: Math.round(i * (1_000_000 / fps)) });
    if (encoder.encodeQueueSize > 4) await encoder.queueReady;
    encoder.encode(frame, { keyFrame: i % 30 === 0 });
    frame.close();

    const p = Math.round((i + 1) / totalFrames * 100);
    progressFill.style.width = p + "%";
    progressLabel.textContent = "Encoding MP4 " + ew + "×" + eh + "… " + p + "% (frame " + (i + 1) + "/" + totalFrames + ")";
  }

  if (cancelled) {
    try { encoder.close(); } catch (e) {}
    return { cancelled: true };
  }

  progressLabel.textContent = "Finalizing MP4…";
  await encoder.flush();
  muxer.finalize();
  const buf = muxer.target.buffer;
  try { encoder.close(); } catch (e) {}
  return { cancelled: false, blob: new Blob([buf], { type: "video/mp4" }), ext: "mp4" };
}

async function runWebMExport() {
  if (typeof MediaRecorder === "undefined") throw new Error("MediaRecorder is not available in this browser");
  if (typeof canvas.captureStream !== "function") throw new Error("canvas.captureStream is not available in this browser");

  const { w: ew, h: eh } = computeExportSize();
  const fps = getEffectiveFps();
  const dur = video.duration;
  const totalFrames = Math.max(1, Math.ceil(dur * fps));
  const mime = pickWebmMime();
  if (!mime) throw new Error("No supported WebM codec");
  log("export", "WebM mime selected", { mime, ew, eh, fps });

  const target = document.createElement("canvas");
  target.width = ew;
  target.height = eh;
  const targetCtx = target.getContext("2d");

  const stream = target.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: computeBitrate(ew, eh) });
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };

  recorder.start();
  video.pause();

  for (let i = 0; i < totalFrames; i++) {
    if (!isExporting) {
      try { recorder.stop(); } catch (e) {}
      try { track.stop(); } catch (e) {}
      return { cancelled: true };
    }
    const targetTime = i / fps;
    await seekTo(targetTime);
    const time = video.currentTime;
    const { prev, next } = findBracketingFrames(time);
    const blobs = interpolateBlobs(prev, next, time);
    renderToTarget(targetCtx, blobs, ew, eh);
    if (typeof track.requestFrame === "function") track.requestFrame();

    const p = Math.round((i + 1) / totalFrames * 100);
    progressFill.style.width = p + "%";
    progressLabel.textContent = "Encoding WebM " + ew + "×" + eh + "… " + p + "% (frame " + (i + 1) + "/" + totalFrames + ")";
  }

  const finalBlob = await new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
    try { recorder.stop(); } catch (e) { resolve(new Blob(chunks, { type: mime })); }
  });
  try { track.stop(); } catch (e) {}
  return { cancelled: false, blob: finalBlob, ext: "webm" };
}

async function runMediabunnyExport() {
  const MediaCodecs = window.MediaCodecs;
  if (!MediaCodecs) throw new Error("Mediabunny not loaded");

  const { w: ew, h: eh } = computeExportSize();
  const fps = getEffectiveFps();
  const dur = video.duration;
  const totalFrames = Math.max(1, Math.ceil(dur * fps));

  exportCanvas.width = ew;
  exportCanvas.height = eh;

  const isMp4 = P.outputCodec === "h264";
  const output = new MediaCodecs.Output({
    format: isMp4
      ? new MediaCodecs.Mp4OutputFormat({ fastStart: "in-memory" })
      : new MediaCodecs.WebMOutputFormat(),
    target: new MediaCodecs.BufferTarget(),
  });

  exportCanvas.width = ew;
  exportCanvas.height = eh;

  const videoSource = new MediaCodecs.CanvasSource(exportCanvas, {
    codec: isMp4 ? "avc" : "vp9",
    bitrate: computeBitrate(ew, eh),
  });
  output.addVideoTrack(videoSource);

  let audioSource = null;
  let audioPromise = Promise.resolve();
  if (currentVideoFile) {
    try {
      const input = new MediaCodecs.Input({
        source: new MediaCodecs.BlobSource(currentVideoFile),
        formats: MediaCodecs.ALL_FORMATS,
      });
      const audioTrack = await input.getPrimaryAudioTrack();
      if (audioTrack) {
        audioSource = new MediaCodecs.AudioSampleSource({
          codec: isMp4 ? "aac" : "opus",
          bitrate: 128_000,
        });
        output.addAudioTrack(audioSource);
        audioPromise = (async () => {
          const sink = new MediaCodecs.AudioSampleSink(audioTrack);
          try {
            for await (const chunk of sink.samples()) {
              if (!isExporting) break;
              const firstTs = await audioTrack.getFirstTimestamp();
              let timeOffset = firstTs < 0 ? -firstTs : 0;
              const ts = chunk.timestamp + timeOffset;
              if (ts !== chunk.timestamp) chunk.setTimestamp(ts);
              await audioSource.add(chunk);
              chunk.close();
            }
          } finally {
            audioSource.close();
          }
        })();
      }
    } catch (e) {
      console.warn("Audio passthrough unavailable, exporting video only:", e.message);
    }
  }

  await output.start();
  video.pause();
  let cancelled = false;
  for (let i = 0; i < totalFrames; i++) {
    if (!isExporting) { cancelled = true; break; }
    const targetTime = i / fps;
    await seekTo(targetTime);
    const time = video.currentTime;
    const { prev, next } = findBracketingFrames(time);
    const blobs = interpolateBlobs(prev, next, time);
    renderToTarget(exportCtx, blobs, ew, eh);
    await videoSource.add(targetTime, 1 / fps);

    const p = Math.round((i + 1) / totalFrames * 100);
    progressFill.style.width = p + "%";
    progressLabel.textContent = "Encoding " + (isMp4 ? "MP4" : "WebM") + " " + ew + "×" + eh + "… " + p + "%";
  }

  if (cancelled) {
    try { await output.abort(); } catch (e) {}
    return { cancelled: true };
  }

  videoSource.close();
  await audioPromise;
  await output.finalize();
  const buf = output.target.buffer;
  return { cancelled: false, blob: new Blob([buf], { type: isMp4 ? "video/mp4" : "video/webm" }), ext: isMp4 ? "mp4" : "webm" };
}

function seekTo(time) {
  return new Promise((resolve) => {
    if (!video || video.readyState < 2) { resolve(); return; }
    const target = Math.min(Math.max(0, time), Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.001) : time);
    if (Math.abs((video.currentTime || 0) - target) < 0.001) { resolve(); return; }
    let done = false;
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      clearTimeout(timer);
    };
    const finish = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve();
    };
    const onSeeked = () => finish();
    const timer = setTimeout(finish, 1200);
    video.addEventListener("seeked", onSeeked, { once: true });
    video.currentTime = target;
  });
}

function isCodecReclaimedError(error) {
  const msg = String((error && error.message) || error || "").toLowerCase();
  return msg.includes("codec reclaimed") || msg.includes("reclaimed due to inactivity");
}

async function startExportMP4() {
  const useMediabunny = !!window.MediaCodecs;
  const wantH264 = P.outputCodec === "h264" && typeof VideoEncoder !== "undefined";
  const wantWebm = P.outputCodec === "webm" || !wantH264;

  if (!wantH264 && !wantWebm) {
    alert("No export engine available. Use a modern Chrome / Edge / Firefox / Safari.");
    return;
  }

  const ext = wantH264 ? "MP4" : "WebM";
  const playbackState = capturePlaybackState();
  startExportUiBusy("Starting " + ext + "…");

  const t0 = performance.now();
  let res;
  try {
    if (useMediabunny) {
      res = await runMediabunnyExport();
    } else if (wantH264) {
      try {
        res = await runWebCodecsExport();
      } catch (e) {
        if (!isCodecReclaimedError(e)) throw e;
        log("export", "WebCodecs encoder reclaimed, retrying as WebM", { error: e.message, params: { ...P } });
        progressLabel.textContent = "MP4 encoder timed out. Retrying as WebM...";
        res = await runWebMExport();
      }
    } else {
      res = await runWebMExport();
    }
  } catch (e) {
    log("export", ext + " export failed", { error: e.message, stack: e.stack, params: { ...P } });
    console.error(ext + " export crashed:", e);
    alert(ext + " export failed: " + e.message);
    await restorePlaybackState(playbackState);
    endExportUi("Export failed");
    return;
  }

  if (res.cancelled) {
    await restorePlaybackState(playbackState);
    endExportUi(ext + " export stopped");
    log("export", ext + " export cancelled");
    return;
  }

  downloadBlob(res.blob, trackedFilename(res.ext));
  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  log("export", ext + " export complete", { size_bytes: res.blob.size, elapsed_s: elapsed });
  await restorePlaybackState(playbackState);
  endExportUi(null);
  if (exportStatus) {
    exportStatus.textContent = "✅ " + ext + " exported!";
    exportStatus.classList.add("visible");
    setTimeout(() => exportStatus.classList.remove("visible"), 3000);
  }
}

function startExport() {
  if (!isExporting) {
    log("export", "Export started", { params: { ...P } });
    startExportMP4();
  } else {
    log("export", "Export stopped");
    stopExport();
  }
}

function stopExport() {
  isExporting = false;
  progressLabel.textContent = "Export stopped";
  exportBtn.disabled = false;
  exportBtn.textContent = "⬇ Export";
  hideCancelExport();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
