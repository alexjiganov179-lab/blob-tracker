# Contour VFX Overlay — Blob Tracker

Browser-based real-time editor for Canny-based contour overlays on videos.
Inspired by artkit.cc/baby-track and whenistheweekend.com/vfx.html, free and offline.

## Features

- **Real-time preview** — drop a video, instant Canvas playback with live param control
- **Live re-detect** — change Canny / blur / blob-size sliders and re-detect without re-uploading
- **15 basic effects** — Basic, Cross, Frame, L-Frame, X-Frame, Grid, Particle, Dash, Scope, Win2K, Glow, Backdrop, Outline, Label, Trail
- **Motion-blur trails** — Trail effect composites up to 30 decaying canvas copies for a true motion-blur look
- **Connecting lines** — nearest, all, chain, or waveform between blobs, with rate control
- **Color & text** — 18-color palette, toggleable text labels with random / position / count content
- **Centroid dots** — optional tracking dots
- **Grouping** — keep raw contour fragments, or merge nearby fragments into a single region
- **Find Objects presets** — Sensitivity (Low / Normal / High / Tiny) and Object Size (Small / Normal / Large) hide the technical sliders
- **GPU Acceleration** — WebGL2 pipeline for blur + Sobel edge detection (5-10x faster than CPU OpenCV)
- **Color Channel Select** — detect on Luminance, Red, Green, or Blue channel (like TouchDesigner)
- **Multi-resolution export** — Preview (canvas size), 1080p (1920×1080 or 1080×1920 for portrait sources), or 9:16 (1080×1920 for Instagram Reels/Stories)
- **Two export engines** — WebCodecs H.264 → MP4 (Chrome/Edge) or MediaRecorder WebM (Firefox/Safari fallback)
- **Smart codec probe** — prefers H.264 High Profile (Level 4.0) for 1080p / Instagram output, Baseline 3.1 for preview
- **Cancel detection / export** — abort long operations without reloading the page
- **Debug logger** — copy a timestamped log of all events and parameter snapshots

## Getting Started

Open `index.html` in Chrome or Edge. OpenCV.js loads from CDN.

1. **Drop a video** anywhere on the page (or click Upload / Load sample)
2. **Tweak parameters** in the right panel — changes render instantly
3. **Optional:** click the **Trail** effect and raise the Trail slider for motion-blur
4. **Pick an Output Size and Codec** (Preview / 1080p / 9:16, MP4 / WebM)
5. **Re-detect** if you change Canny / blur / blob-size
6. **Click Export** → file downloads automatically. Use ⏹ Stop to cancel

## Parameter Overview

| Section | Controls |
|---|---|
| **Find Objects** | Sensitivity preset (Low / Normal / High / Tiny), Object Size preset (Small / Normal / Large), Re-detect button |
| **Video Speed** | 0.5× / 1× / 2× / 4× playback |
| **Basic Effects** | Basic, Cross, Label, Frame, L-Frame, X-Frame, Grid, Particle, Dash, Scope, Win2K, Glow, Backdrop, Outline, Trail (0–30 frame trail length) |
| **Connection** | Line style (Nearest / All / Chain / Wave) + rate (0–Full) |
| **Stroke Width** | 0.5–10px |
| **Blob Size** | Min / Max area filters |
| **Detection** | Canny low / high, Gaussian blur, **Color Channel** (Lum / R / G / B), **GPU toggle** |
| **Grouping** | Detail (raw contours) / Grouped (merge nearby fragments), with kernel + iterations |
| **Color & Text** | 18-color palette, text on/off, position (Center / Top / Bottom), content (Random / Position / Count), font size |
| **Centroid** | Show tracking dots on/off |
| **Output** | Output FPS (Source / 30 / 60), Output Size (Preview / 1080p / 9:16), Codec (MP4 / WebM) |

## Export Format

| Format | Engine | Resolutions | Codec probe | Best for |
|---|---|---|---|---|
| **MP4** | WebCodecs H.264 → `mp4-muxer` | Preview / 1080p / 9:16 (1080×1920) | `avc1.640028` (High 4.0) for full-res, `avc1.42001F` (Baseline 3.1) for preview, fallbacks tried in order | Social sharing, Instagram Reels / Stories |
| **WebM** | `MediaRecorder` on `canvas.captureStream(0)` | Same | VP9 / VP8 (whichever `MediaRecorder.isTypeSupported` accepts first) | Firefox / Safari, quick previews |

The MP4 muxer (`mp4-muxer`) is loaded as an ES module from a CDN. MP4 files use `fastStart: "in-memory"` so the `moov` box is at the front and the file is web-streamable without a post-process.

### Requirements

- **Chrome or Edge** recommended for the full experience (WebCodecs MP4 + High Profile). Firefox / Safari fall back to WebM via MediaRecorder.
- **Internet on first load** for OpenCV.js and the MP4 muxer. Once cached, the app runs offline.
- For `presets.json` and similar local fetches, run a local server (e.g. `npx serve .`) — opening `index.html` directly via `file://` will block those fetches.

## Known Limitations

- **Contour tracking, not object tracking** — IDs can flicker between frames for fast-moving or briefly occluded objects
- **No audio in export** — video only.
- **Trail and full-res export are RAM-heavy** — Trail keeps up to 30 canvas copies in memory; 1080p export allocates a 1920×1080 offscreen canvas. Lower the trail length or pick the Preview size on low-RAM devices.
- **WebM export uses real-time capture** — encoding happens in the browser's MediaRecorder and depends on the host's VP8/VP9 hardware support. On machines without a hardware encoder this can be slow.
- **Preview resolution is downscaled** — detection runs on a frame sized to fit `MAX_PREVIEW_DIM`. Full-res export scales the preview coordinates to the target size with letterbox / pillarbox.
- **No multi-clip timeline, no keyframes, no webcam input** — see `PLAN.md` for the roadmap (Phases 4-6).

See `PLAN.md` for the development roadmap (Phases 1-6) and `gstack-design-review.md` for the design audit.

