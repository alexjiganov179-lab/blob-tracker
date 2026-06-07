# Contour VFX Overlay — Blob Tracker

Browser-based real-time editor for Canny-based contour overlays on videos.
Inspired by artkit.cc/baby-track and whenistheweekend.com/vfx.html, free and offline.

## Features

- **Real-time preview** — drop a video, instant Canvas playback with live param control
- **Live re-detect** — change Canny / blur / blob-size sliders and re-detect without re-uploading
- **14 basic effects** — Basic, Cross, Frame, L-Frame, X-Frame, Grid, Particle, Dash, Scope, Win2K, Glow, Backdrop, Outline, Label
- **Connecting lines** — nearest, all, chain, or waveform between blobs, with rate control
- **Color & text** — 18-color palette, toggleable text labels with random / position / count content
- **Centroid dots** — optional tracking dots
- **Grouping** — keep raw contour fragments, or merge nearby fragments into a single region
- **Find Objects presets** — Sensitivity (Low / Normal / High / Tiny) and Object Size (Small / Normal / Large) hide the technical sliders
- **GPU Acceleration** — WebGL2 pipeline for blur + Sobel edge detection (5-10x faster than CPU OpenCV)
- **Color Channel Select** — detect on Luminance, Red, Green, or Blue channel (like TouchDesigner)
- **Export to MP4** — WebCodecs H.264 via Chrome / Edge. Cancel button to abort mid-export
- **Cancel detection** — abort a long-running re-detect without reloading the page
- **Debug logger** — copy a timestamped log of all events and parameter snapshots

## Getting Started

Open `index.html` in Chrome or Edge. OpenCV.js loads from CDN.

1. **Drop a video** anywhere on the page (or click Upload / Load sample)
2. **Tweak parameters** in the right panel — changes render instantly
3. **Re-detect** if you change Canny / blur / blob-size
4. **Click Export MP4** → file downloads automatically. Use ⏹ Stop to cancel

## Parameter Overview

| Section | Controls |
|---|---|
| **Find Objects** | Sensitivity preset (Low / Normal / High / Tiny), Object Size preset (Small / Normal / Large), Re-detect button |
| **Video Speed** | 0.5× / 1× / 2× / 4× playback |
| **Basic Effects** | Basic, Cross, Label, Frame, L-Frame, X-Frame, Grid, Particle, Dash, Scope, Win2K, Glow, Backdrop, Outline |
| **Connection** | Line style (Nearest / All / Chain / Wave) + rate (0–Full) |
| **Stroke Width** | 0.5–10px |
| **Blob Size** | Min / Max area filters |
| **Detection** | Canny low / high, Gaussian blur, **Color Channel** (Lum / R / G / B), **GPU toggle** |
| **Grouping** | Detail (raw contours) / Grouped (merge nearby fragments), with kernel + iterations |
| **Color & Text** | 18-color palette, text on/off, position (Center / Top / Bottom), content (Random / Position / Count), font size |
| **Centroid** | Show tracking dots on/off |
| **Export** | MP4 export + cancel button |

## Export Format

| Format | Engine | Resolution | Bitrate | Best for |
|---|---|---|---|---|
| **MP4** | WebCodecs H.264 Baseline | Canvas size | 8 Mbps | Desktop playback, social sharing |

The MP4 muxer (`mp4-muxer`) is loaded as an ES module from a CDN.

### Requirements

- **Chrome or Edge** for MP4 export — WebCodecs API is not available in Firefox or Safari.
- **Internet on first load** for OpenCV.js and the MP4 muxer. Once cached, the app runs offline.
- For `presets.json` and similar local fetches, run a local server (e.g. `npx serve .`) — opening `index.html` directly via `file://` will block those fetches.

## Known Limitations

- **Contour tracking, not object tracking** — IDs can flicker between frames for fast-moving or briefly occluded objects
- **MP4 export requires Chrome / Edge** — no WebM fallback yet
- **Preview resolution is downscaled** — detection runs on a frame sized to fit `MAX_PREVIEW_DIM`
- **No audio in export** — video only
- **No multi-clip timeline, no keyframes, no webcam input** — see `PLAN.md` for the roadmap

See `PLAN.md` for the development roadmap (Phases 1-6) and `gstack-design-review.md` for the design audit.
