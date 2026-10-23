// ============================
// EFFECTS REGISTRY
// ============================

const particleStates = new Map();
const fireStates = new Map();
const starTrailStates = new Map();

// ============================
// BASIC & STUDIO VFX EFFECTS
// ============================
function drawBasicEffect(ctx2d, blobs) {
  const sw = P.strokeWidth;
  ctx2d.lineWidth = sw; ctx2d.lineJoin = "round";
  for (const b of blobs) {
    ctx2d.strokeStyle = P.contourColor;
    const pts = getContourPts(b); if (!pts) continue;
    ctx2d.beginPath(); ctx2d.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx2d.lineTo(pts[i].x, pts[i].y);
    ctx2d.closePath(); ctx2d.stroke();
  }
}

function drawNeonEffect(ctx2d, blobs) {
  const sw = P.strokeWidth;
  ctx2d.save();
  ctx2d.lineJoin = "round";
  for (const b of blobs) {
    const pts = getContourPts(b); if (!pts) continue;
    // Outer ambient glow
    ctx2d.lineWidth = sw * 2.8;
    ctx2d.strokeStyle = P.contourColor;
    ctx2d.globalAlpha = 0.32;
    ctx2d.beginPath(); ctx2d.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx2d.lineTo(pts[i].x, pts[i].y);
    ctx2d.closePath(); ctx2d.stroke();
    // Inner crisp luminous core
    ctx2d.lineWidth = sw;
    ctx2d.strokeStyle = "#ffffff";
    ctx2d.globalAlpha = 0.92;
    ctx2d.beginPath(); ctx2d.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx2d.lineTo(pts[i].x, pts[i].y);
    ctx2d.closePath(); ctx2d.stroke();
  }
  ctx2d.restore();
}

function drawGhostEffect(ctx2d, blobs) {
  const sw = P.strokeWidth;
  ctx2d.save();
  for (const b of blobs) {
    const pts = getContourPts(b); if (!pts) continue;
    // Translucent phantom silhouette
    ctx2d.fillStyle = P.contourColor;
    ctx2d.globalAlpha = 0.22;
    ctx2d.beginPath(); ctx2d.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx2d.lineTo(pts[i].x, pts[i].y);
    ctx2d.closePath(); ctx2d.fill();
    // Trailing contour
    ctx2d.lineWidth = sw;
    ctx2d.strokeStyle = P.contourColor;
    ctx2d.globalAlpha = 0.6;
    ctx2d.stroke();
  }
  ctx2d.restore();
}

function drawMatrixEffect(ctx2d, blobs) {
  const chars = "0123456789ABCDEFｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ";
  ctx2d.save();
  ctx2d.font = "11px monospace";
  for (const b of blobs) {
    const pts = getContourPts(b);
    if (pts) {
      ctx2d.strokeStyle = "#00ff77";
      ctx2d.lineWidth = 1;
      ctx2d.globalAlpha = 0.55;
      ctx2d.beginPath(); ctx2d.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx2d.lineTo(pts[i].x, pts[i].y);
      ctx2d.closePath(); ctx2d.stroke();
    }
    const cols = Math.max(1, Math.floor(b.bw / 12));
    const seed = (b.id || 1) * 37;
    for (let c = 0; c < cols; c++) {
      const cx = b.bx + c * 12 + 2;
      const count = Math.min(6, Math.floor(b.bh / 12));
      for (let r = 0; r < count; r++) {
        const cy = b.by + ((r * 13 + (Date.now() / 70 + seed + c * 7)) % Math.max(16, b.bh));
        const ch = chars[(seed + c * 5 + r * 3) % chars.length];
        const isHead = r === count - 1;
        ctx2d.fillStyle = isHead ? "#ffffff" : "#00ff77";
        ctx2d.globalAlpha = isHead ? 0.95 : 0.65;
        ctx2d.fillText(ch, cx, cy);
      }
    }
  }
  ctx2d.restore();
}

function drawRainbowEffect(ctx2d, blobs) {
  const sw = P.strokeWidth;
  ctx2d.save();
  ctx2d.lineWidth = sw;
  ctx2d.lineJoin = "round";
  const t = Date.now() / 25;
  for (let idx = 0; idx < blobs.length; idx++) {
    const b = blobs[idx];
    const pts = getContourPts(b); if (!pts) continue;
    const hue = (t + idx * 45 + (b.id || 0) * 55) % 360;
    ctx2d.strokeStyle = `hsl(${hue}, 100%, 62%)`;
    ctx2d.beginPath(); ctx2d.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx2d.lineTo(pts[i].x, pts[i].y);
    ctx2d.closePath(); ctx2d.stroke();
  }
  ctx2d.restore();
}

function drawFireEffect(ctx2d, blobs) {
  const alive = new Set(blobs.map(b => b.id));
  for (const id of fireStates.keys()) if (!alive.has(id)) fireStates.delete(id);
  const now = performance.now();
  for (const b of blobs) {
    let state = fireStates.get(b.id);
    if (!state) { state = []; fireStates.set(b.id, state); }
    for (let i = state.length - 1; i >= 0; i--) {
      const p = state[i];
      if (now - p.spawn > 650) { state.splice(i, 1); continue; }
      p.x += p.vx; p.y += p.vy;
    }
    const spawnCount = 3;
    for (let i = 0; i < spawnCount; i++) {
      state.push({
        x: b.x + (Math.random() - 0.5) * (b.bw * 0.7),
        y: b.by + b.bh - Math.random() * 4,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -(1.2 + Math.random() * 2.2),
        size: 2 + Math.random() * 3.5,
        spawn: now,
      });
    }
  }
  ctx2d.save();
  for (const state of fireStates.values()) {
    for (const p of state) {
      const age = now - p.spawn;
      const progress = age / 650;
      const alpha = Math.max(0, 1 - progress);
      const r = 255;
      const g = Math.round(180 * (1 - progress * 0.8));
      const b = Math.round(30 * (1 - progress));
      ctx2d.fillStyle = `rgba(${r},${g},${b},${alpha * 0.75})`;
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, p.size * (1 - progress * 0.4), 0, Math.PI * 2);
      ctx2d.fill();
    }
  }
  drawBasicEffect(ctx2d, blobs);
  ctx2d.restore();
}

function drawCrtEffect(ctx2d, blobs) {
  const sw = P.strokeWidth;
  ctx2d.save();
  for (const b of blobs) {
    ctx2d.strokeStyle = P.contourColor;
    ctx2d.lineWidth = sw;
    ctx2d.strokeRect(b.bx, b.by, b.bw, b.bh);
    const step = 4;
    ctx2d.strokeStyle = P.contourColor;
    ctx2d.lineWidth = 1;
    ctx2d.globalAlpha = 0.28;
    for (let y = b.by; y <= b.by + b.bh; y += step) {
      ctx2d.beginPath(); ctx2d.moveTo(b.bx, y); ctx2d.lineTo(b.bx + b.bw, y); ctx2d.stroke();
    }
    ctx2d.globalAlpha = 1;
  }
  ctx2d.restore();
}

function drawHalftoneEffect(ctx2d, blobs) {
  ctx2d.save();
  ctx2d.fillStyle = P.contourColor;
  for (const b of blobs) {
    const step = 8;
    const maxR = 3.5;
    for (let y = b.by + 4; y <= b.by + b.bh - 4; y += step) {
      for (let x = b.bx + 4; x <= b.bx + b.bw - 4; x += step) {
        const dx = (x - b.x) / (b.bw / 2 || 1);
        const dy = (y - b.y) / (b.bh / 2 || 1);
        const dist = Math.hypot(dx, dy);
        if (dist > 1.1) continue;
        const r = Math.max(0.8, (1 - dist * 0.7) * maxR);
        ctx2d.beginPath(); ctx2d.arc(x, y, r, 0, Math.PI * 2); ctx2d.fill();
      }
    }
    drawBasicEffect(ctx2d, [b]);
  }
  ctx2d.restore();
}

function drawComicEffect(ctx2d, blobs) {
  const sw = Math.max(2, P.strokeWidth);
  ctx2d.save();
  for (const b of blobs) {
    const pad = 6;
    const x = b.bx - pad, y = b.by - pad, w = b.bw + pad * 2, h = b.bh + pad * 2;
    ctx2d.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx2d.fillRect(x + 3, y + 3, w, h);
    ctx2d.strokeStyle = "#000000";
    ctx2d.lineWidth = sw + 2;
    ctx2d.strokeRect(x, y, w, h);
    ctx2d.strokeStyle = P.contourColor;
    ctx2d.lineWidth = sw;
    ctx2d.strokeRect(x, y, w, h);
  }
  ctx2d.restore();
}

function drawBlueprintEffect(ctx2d, blobs) {
  const sw = P.strokeWidth;
  ctx2d.save();
  ctx2d.strokeStyle = P.contourColor;
  ctx2d.lineWidth = sw;
  for (const b of blobs) {
    const arm = 12;
    const x1 = b.bx, y1 = b.by, x2 = b.bx + b.bw, y2 = b.by + b.bh;
    ctx2d.beginPath();
    ctx2d.moveTo(x1, y1 + arm); ctx2d.lineTo(x1, y1); ctx2d.lineTo(x1 + arm, y1);
    ctx2d.moveTo(x2 - arm, y1); ctx2d.lineTo(x2, y1); ctx2d.lineTo(x2, y1 + arm);
    ctx2d.moveTo(x2, y2 - arm); ctx2d.lineTo(x2, y2); ctx2d.lineTo(x2 - arm, y2);
    ctx2d.moveTo(x1 + arm, y2); ctx2d.lineTo(x1, y2); ctx2d.lineTo(x1, y2 - arm);
    ctx2d.stroke();
    // Center reticle cross
    const r = 8;
    ctx2d.beginPath();
    ctx2d.moveTo(b.x - r, b.y); ctx2d.lineTo(b.x + r, b.y);
    ctx2d.moveTo(b.x, b.y - r); ctx2d.lineTo(b.x, b.y + r);
    ctx2d.stroke();
  }
  ctx2d.restore();
}

function drawGlowEdgeEffect(ctx2d, blobs) {
  const sw = P.strokeWidth;
  ctx2d.save();
  ctx2d.lineJoin = "round";
  for (const b of blobs) {
    const pts = getContourPts(b); if (!pts) continue;
    ctx2d.lineWidth = sw * 2.2;
    ctx2d.strokeStyle = P.contourColor;
    ctx2d.globalAlpha = 0.45;
    ctx2d.beginPath(); ctx2d.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx2d.lineTo(pts[i].x, pts[i].y);
    ctx2d.closePath(); ctx2d.stroke();
    ctx2d.lineWidth = sw;
    ctx2d.strokeStyle = P.contourColor;
    ctx2d.globalAlpha = 1;
    ctx2d.stroke();
  }
  ctx2d.restore();
}

function drawStarTrailEffect(ctx2d, blobs) {
  const alive = new Set(blobs.map(b => b.id));
  for (const id of starTrailStates.keys()) if (!alive.has(id)) starTrailStates.delete(id);
  const now = performance.now();
  for (const b of blobs) {
    let state = starTrailStates.get(b.id);
    if (!state) { state = []; starTrailStates.set(b.id, state); }
    state.push({ x: b.x, y: b.y, spawn: now });
    if (state.length > 18) state.shift();
  }
  ctx2d.save();
  for (const state of starTrailStates.values()) {
    if (state.length < 2) continue;
    for (let i = 1; i < state.length; i++) {
      const alpha = (i / state.length) * 0.75;
      ctx2d.strokeStyle = P.contourColor;
      ctx2d.lineWidth = Math.max(1, (i / state.length) * 3);
      ctx2d.globalAlpha = alpha;
      ctx2d.beginPath();
      ctx2d.moveTo(state[i - 1].x, state[i - 1].y);
      ctx2d.lineTo(state[i].x, state[i].y);
      ctx2d.stroke();
    }
  }
  drawBasicEffect(ctx2d, blobs);
  ctx2d.restore();
}

function drawCrossEffect(ctx2d, blobs) {
  const sw = P.strokeWidth;
  ctx2d.lineWidth = sw; ctx2d.strokeStyle = P.contourColor;
  for (const b of blobs) {
    const arm = 18;
    ctx2d.beginPath();
    ctx2d.moveTo(b.x - arm, b.y); ctx2d.lineTo(b.x + arm, b.y);
    ctx2d.moveTo(b.x, b.y - arm); ctx2d.lineTo(b.x, b.y + arm);
    ctx2d.stroke();
  }
}

function drawFrameEffect(ctx2d, blobs) {
  const sw = P.strokeWidth;
  ctx2d.lineWidth = sw; ctx2d.strokeStyle = P.contourColor;
  for (const b of blobs) {
    const arm = 10;
    const x1 = b.x - arm, y1 = b.y - arm, x2 = b.x + arm, y2 = b.y + arm;
    ctx2d.beginPath();
    ctx2d.moveTo(x1, y1 + arm); ctx2d.lineTo(x1, y1); ctx2d.lineTo(x1 + arm, y1);
    ctx2d.moveTo(x2 - arm, y1); ctx2d.lineTo(x2, y1); ctx2d.lineTo(x2, y1 + arm);
    ctx2d.moveTo(x2, y2 - arm); ctx2d.lineTo(x2, y2); ctx2d.lineTo(x2 - arm, y2);
    ctx2d.moveTo(x1 + arm, y2); ctx2d.lineTo(x1, y2); ctx2d.lineTo(x1, y2 - arm);
    ctx2d.stroke();
  }
}

function drawLFrameEffect(ctx2d, blobs) {
  const sw = P.strokeWidth;
  ctx2d.lineWidth = sw; ctx2d.strokeStyle = P.contourColor;
  for (const b of blobs) {
    const arm = 10;
    const x1 = b.bx, y1 = b.by, x2 = b.bx + b.bw, y2 = b.by + b.bh;
    ctx2d.beginPath();
    ctx2d.moveTo(x1, y1 + arm); ctx2d.lineTo(x1, y1); ctx2d.lineTo(x1 + arm, y1);
    ctx2d.moveTo(x2 - arm, y1); ctx2d.lineTo(x2, y1); ctx2d.lineTo(x2, y1 + arm);
    ctx2d.moveTo(x2, y2 - arm); ctx2d.lineTo(x2, y2); ctx2d.lineTo(x2 - arm, y2);
    ctx2d.moveTo(x1 + arm, y2); ctx2d.lineTo(x1, y2); ctx2d.lineTo(x1, y2 - arm);
    ctx2d.stroke();
  }
}

function drawXFrameEffect(ctx2d, blobs) {
  const sw = P.strokeWidth;
  ctx2d.lineWidth = sw; ctx2d.strokeStyle = P.contourColor;
  for (const b of blobs) {
    ctx2d.beginPath();
    ctx2d.moveTo(b.bx, b.by); ctx2d.lineTo(b.bx + b.bw, b.by + b.bh);
    ctx2d.moveTo(b.bx + b.bw, b.by); ctx2d.lineTo(b.bx, b.by + b.bh);
    ctx2d.stroke();
  }
}

function drawGridEffect(ctx2d, blobs) {
  if (!blobs.length) return;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of blobs) {
    if (b.bx < minX) minX = b.bx;
    if (b.by < minY) minY = b.by;
    if (b.bx + b.bw > maxX) maxX = b.bx + b.bw;
    if (b.by + b.bh > maxY) maxY = b.by + b.bh;
  }
  const sw = P.strokeWidth;
  ctx2d.lineWidth = sw; ctx2d.strokeStyle = P.contourColor; ctx2d.globalAlpha = 0.5;
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const x = minX + (maxX - minX) * i / steps;
    ctx2d.beginPath(); ctx2d.moveTo(x, minY); ctx2d.lineTo(x, maxY); ctx2d.stroke();
  }
  for (let i = 0; i <= steps; i++) {
    const y = minY + (maxY - minY) * i / steps;
    ctx2d.beginPath(); ctx2d.moveTo(minX, y); ctx2d.lineTo(maxX, y); ctx2d.stroke();
  }
  ctx2d.globalAlpha = 1;
}

function drawParticleEffect(ctx2d, blobs) {
  const lifeMs = 900;
  const spawnPerFrame = 2;
  const alive = new Set(blobs.map(b => b.id));
  for (const id of particleStates.keys()) {
    if (!alive.has(id)) particleStates.delete(id);
  }
  for (const state of particleStates.values()) {
    for (let i = state.length - 1; i >= 0; i--) {
      const p = state[i];
      const age = performance.now() - p.spawn;
      if (age > lifeMs) { state.splice(i, 1); continue; }
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.97; p.vy *= 0.97;
    }
  }
  for (const b of blobs) {
    let state = particleStates.get(b.id);
    if (!state) { state = []; particleStates.set(b.id, state); }
    for (let i = 0; i < spawnPerFrame; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;
      state.push({
        x: b.x, y: b.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        spawn: performance.now(),
      });
    }
  }
  ctx2d.fillStyle = P.contourColor;
  for (const state of particleStates.values()) {
    for (const p of state) {
      const age = performance.now() - p.spawn;
      const alpha = Math.max(0, 1 - age / lifeMs);
      ctx2d.globalAlpha = alpha * 0.6;
      ctx2d.beginPath(); ctx2d.arc(p.x, p.y, 1.5, 0, Math.PI * 2); ctx2d.fill();
    }
  }
  ctx2d.globalAlpha = 1;
}

function drawDashEffect(ctx2d, blobs) {
  const sw = P.strokeWidth;
  ctx2d.lineWidth = sw; ctx2d.strokeStyle = P.contourColor;
  ctx2d.setLineDash([5, 5]);
  for (const b of blobs) {
    ctx2d.strokeRect(b.bx, b.by, b.bw, b.bh);
  }
  ctx2d.setLineDash([]);
}

function drawScopeEffect(ctx2d, blobs) {
  const sw = P.strokeWidth;
  ctx2d.lineWidth = sw; ctx2d.strokeStyle = P.contourColor;
  for (const b of blobs) {
    const r = Math.max(b.bw, b.bh) / 2;
    const cx = b.bx + b.bw / 2, cy = b.by + b.bh / 2;
    ctx2d.beginPath(); ctx2d.arc(cx, cy, r, 0, Math.PI * 2); ctx2d.stroke();
    ctx2d.beginPath();
    ctx2d.moveTo(cx - r - 5, cy); ctx2d.lineTo(cx + r + 5, cy);
    ctx2d.moveTo(cx, cy - r - 5); ctx2d.lineTo(cx, cy + r + 5);
    ctx2d.stroke();
  }
}

function drawWin2KEffect(ctx2d, blobs) {
  const sw = P.strokeWidth;
  ctx2d.lineWidth = sw; ctx2d.strokeStyle = P.contourColor;
  for (const b of blobs) {
    const mar = 4;
    ctx2d.fillStyle = "rgba(0,0,0,0.3)";
    ctx2d.fillRect(b.bx - mar, b.by - mar, b.bw + mar * 2, b.bh + mar * 2);
    ctx2d.strokeRect(b.bx - mar, b.by - mar, b.bw + mar * 2, b.bh + mar * 2);
    ctx2d.fillStyle = "rgba(0,255,0,0.08)";
    ctx2d.fillRect(b.bx, b.by, b.bw, b.bh);
    ctx2d.fillStyle = P.contourColor;
    ctx2d.font = "10px monospace";
    ctx2d.fillText("#" + (b.id || 0) + " " + b.area, b.bx + 2, b.by + 12);
  }
}

function drawBackdropEffect(ctx2d, blobs) {
  ctx2d.fillStyle = "rgba(0,0,0,0.4)";
  for (const b of blobs) {
    const mar = 6;
    ctx2d.fillRect(b.bx - mar, b.by - mar, b.bw + mar * 2, b.bh + mar * 2);
  }
  drawBasicEffect(ctx2d, blobs);
}

// ============================
// NEW APOLOTARY EFFECTS
// ============================
function drawEmojisEffect(ctx2d, blobs) {
  const lifeMs = 1000;
  const spawnPerFrame = 4;
  const emojis = ["🔥", "⭐", "💫", "✨", "⚡", "💥", "🎯", "🌀"];
  const alive = new Set(blobs.map(b => b.id));
  if (!drawEmojisEffect._particles) drawEmojisEffect._particles = new Map();
  const states = drawEmojisEffect._particles;
  for (const id of states.keys()) if (!alive.has(id)) states.delete(id);
  for (const state of states.values()) {
    for (let i = state.length - 1; i >= 0; i--) {
      const p = state[i];
      if (performance.now() - p.spawn > lifeMs) { state.splice(i, 1); continue; }
      p.x += p.vx; p.y += p.vy; p.vx *= 0.97; p.vy *= 0.97;
    }
  }
  for (const b of blobs) {
    let state = states.get(b.id);
    if (!state) { state = []; states.set(b.id, state); }
    for (let i = 0; i < spawnPerFrame; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 2;
      const hue = (b.id || 0) * 137.5 + Math.random() * 30;
      state.push({ x: b.x, y: b.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, spawn: performance.now(), emoji: emojis[Math.floor(Math.random() * emojis.length)], hue });
    }
  }
  for (const state of states.values()) {
    for (const p of state) {
      const age = performance.now() - p.spawn;
      const alpha = Math.max(0, 1 - age / lifeMs);
      ctx2d.globalAlpha = alpha * 0.8;
      ctx2d.font = "14px sans-serif";
      ctx2d.fillText(p.emoji, p.x, p.y);
    }
  }
  ctx2d.globalAlpha = 1;
}

function drawHeatmapEffect(ctx2d, blobs) {
  const w = ctx2d.canvas.width, h = ctx2d.canvas.height;
  if (!drawHeatmapEffect._buf || drawHeatmapEffect._buf.length !== w * h) {
    drawHeatmapEffect._buf = new Float32Array(w * h);
  }
  const buf = drawHeatmapEffect._buf;
  // Decay
  for (let i = 0; i < buf.length; i++) buf[i] *= 0.992;
  // Add
  for (const b of blobs) {
    const x0 = Math.max(0, Math.round(b.bx));
    const y0 = Math.max(0, Math.round(b.by));
    const x1 = Math.min(w - 1, Math.round(b.bx + b.bw));
    const y1 = Math.min(h - 1, Math.round(b.by + b.bh));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      buf[y * w + x] = Math.min(1, buf[y * w + x] + 0.12);
    }
  }
  // Render inferno-style
  const imgData = ctx2d.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = Math.min(1, buf[i]);
    let r, g, b;
    if (v < 0.25) { const t = v / 0.25; r = 0; g = 0; b = t; }
    else if (v < 0.5) { const t = (v - 0.25) / 0.25; r = t; g = 0; b = 1 - t; }
    else if (v < 0.75) { const t = (v - 0.5) / 0.25; r = 1; g = t; b = 0; }
    else { const t = (v - 0.75) / 0.25; r = 1; g = 1; b = t; }
    imgData.data[i * 4] = Math.round(r * 255);
    imgData.data[i * 4 + 1] = Math.round(g * 255);
    imgData.data[i * 4 + 2] = Math.round(b * 255);
    imgData.data[i * 4 + 3] = 200;
  }
  ctx2d.putImageData(imgData, 0, 0);
}

function drawVoronoiEffect(ctx2d, blobs) {
  if (blobs.length < 2) return;
  ctx2d.strokeStyle = P.contourColor;
  ctx2d.lineWidth = 1;
  ctx2d.globalAlpha = 0.7;
  for (let i = 0; i < blobs.length; i++) {
    for (let j = i + 1; j < blobs.length; j++) {
      const mx = (blobs[i].x + blobs[j].x) / 2;
      const my = (blobs[i].y + blobs[j].y) / 2;
      const dx = blobs[j].x - blobs[i].x;
      const dy = blobs[j].y - blobs[i].y;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      const len = 2000;
      const nx = -dy, ny = dx;
      const nl = Math.hypot(nx, ny);
      const ux = nx / nl * len, uy = ny / nl * len;
      ctx2d.beginPath();
      ctx2d.moveTo(mx - ux, my - uy);
      ctx2d.lineTo(mx + ux, my + uy);
      ctx2d.stroke();
    }
  }
  ctx2d.globalAlpha = 1;
}

function drawConvexHullEffect(ctx2d, blobs) {
  if (blobs.length < 3) return;
  const pts = blobs.map(b => ({ x: b.x, y: b.y }));
  pts.sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  const hull = lower.concat(upper);
  if (hull.length < 3) return;
  ctx2d.strokeStyle = P.contourColor;
  ctx2d.lineWidth = 2;
  ctx2d.beginPath();
  ctx2d.moveTo(hull[0].x, hull[0].y);
  for (let i = 1; i < hull.length; i++) ctx2d.lineTo(hull[i].x, hull[i].y);
  ctx2d.closePath(); ctx2d.stroke();
}

// ============================
// EFFECTS REGISTRY
// ============================
const EFFECTS = [
  // 15 Studio VFX Styles
  { id: "neon",       label: "Neon",       group: "vfx",   draw: drawNeonEffect },
  { id: "ghost",      label: "Ghost",      group: "vfx",   draw: drawGhostEffect },
  { id: "matrix",     label: "Matrix",     group: "vfx",   draw: drawMatrixEffect },
  { id: "rainbow",    label: "Rainbow",    group: "vfx",   draw: drawRainbowEffect },
  { id: "fire",       label: "Fire",       group: "vfx",   draw: drawFireEffect },
  { id: "sparkles",   label: "Sparkles",   group: "vfx",   draw: drawParticleEffect },
  { id: "crt",        label: "CRT",        group: "vfx",   draw: drawCrtEffect },
  { id: "halftone",   label: "Halftone",   group: "vfx",   draw: drawHalftoneEffect },
  { id: "comic",      label: "Comic",      group: "vfx",   draw: drawComicEffect },
  { id: "thermal",    label: "Thermal",    group: "vfx",   draw: drawHeatmapEffect },
  { id: "blueprint",  label: "Blueprint",  group: "vfx",   draw: drawBlueprintEffect },
  { id: "glowEdge",   label: "Glow Edge",  group: "vfx",   draw: drawGlowEdgeEffect },
  { id: "starTrail",  label: "Star Trail", group: "vfx",   draw: drawStarTrailEffect },
  { id: "wireframe",  label: "Wireframe",  group: "vfx",   draw: drawVoronoiEffect },
  { id: "liquid",     label: "Liquid",     group: "vfx",   draw: drawConvexHullEffect },

  // Legacy aliases
  { id: "Basic",      label: "Contour",    group: "legacy", draw: drawBasicEffect },
  { id: "Cross",      label: "Cross",      group: "legacy", draw: drawCrossEffect },
  { id: "Frame",      label: "Frame",      group: "legacy", draw: drawFrameEffect },
  { id: "L-Frame",    label: "L-Frame",    group: "legacy", draw: drawLFrameEffect },
  { id: "X-Frame",    label: "X-Frame",    group: "legacy", draw: drawXFrameEffect },
  { id: "Grid",       label: "Grid",       group: "legacy", draw: drawGridEffect },
  { id: "Particle",   label: "Particle",   group: "legacy", draw: drawParticleEffect },
  { id: "Dash",       label: "Dash",       group: "legacy", draw: drawDashEffect },
  { id: "Scope",      label: "Scope",      group: "legacy", draw: drawScopeEffect },
  { id: "Win2K",      label: "Win2K",      group: "legacy", draw: drawWin2KEffect },
  { id: "Backdrop",   label: "Backdrop",   group: "legacy", draw: drawBackdropEffect },
  { id: "Emojis",     label: "Emojis",     group: "legacy", draw: drawEmojisEffect },
  { id: "Heatmap",    label: "Heatmap",    group: "legacy", draw: drawHeatmapEffect },
  { id: "Voronoi",    label: "Voronoi",    group: "legacy", draw: drawVoronoiEffect },
  { id: "ConvexHull", label: "ConvexHull", group: "legacy", draw: drawConvexHullEffect },
];

const EFFECTS_BY_ID = Object.fromEntries(EFFECTS.map(e => [e.id, e]));
// Case-insensitive lookup fallback
for (const e of EFFECTS) {
  EFFECTS_BY_ID[e.id.toLowerCase()] = e;
}

function drawEffectLayer(ctx2d, blobs) {
  if (!blobs || !blobs.length) return;
  const key = P.selectedEffect || "neon";
  const effect = EFFECTS_BY_ID[key] || EFFECTS_BY_ID[key.toLowerCase()] || EFFECTS_BY_ID["neon"] || EFFECTS_BY_ID["Basic"];
  if (effect && typeof effect.draw === "function") {
    effect.draw(ctx2d, blobs, P);
  }
}
