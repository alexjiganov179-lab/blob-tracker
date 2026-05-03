# Contour VFX Overlay — Blob Tracker

Browser-based real-time editor for Canny-based contour overlays on videos.
Inspired by artkit.cc/baby-track and whenistheweekend.com/vfx.html, free and offline.

## Features

- **Real-time preview** — drop a video, instant Canvas playback with live param control
- **No render needed** — color, thickness, trails, lines, labels all update on Canvas
- **9:16 crop for Instagram Reels** — center-crop or blob-follow, export at native 1080×1920
- **Connecting lines** — nearest, all-to-all, chain, or waveform between blobs
- **14+ basic effects** + **14 filter effects** — cross, frame, glitch, thermal, CRT, etc.
- **Re-detect** — refine Canny/blur/blob params without re-uploading
- **Export to WebM or MP4** — WebM via MediaRecorder (all browsers), MP4 via WebCodecs (Chrome/Edge)

## Getting Started

Open `index.html` in Chrome/Edge. OpenCV.js loads from CDN.

1. **Drop a video** anywhere on the page (or click Upload / Load sample)
2. **Tweak parameters** in the right panel — changes render instantly
3. **Click Export** → select format → file downloads automatically

## Parameter Overview

| Section | Controls |
|---|---|
| **Video Speed** | 0.5× / 1× / 2× / 4× playback |
| **Shape** | Contour / Circle / BBox |
| **Region Style** | Fill regions, random shapes |
| **Basic Effects** | Basic, Cross, Frame, L-Frame, X-Frame, Grid, Particle, Dash, Scope, Win2K, Glow, Backdrop, Outline, Label |
| **Filter Effects** | Inv, Glitch, Thermal, Pixel, Tone, Blur, Dither, Zoom, X-Ray, Water, Mask, CRT, Edge |
| **Connection** | 4 line styles + rate (0–full) |
| **Stroke Width** | 0.5–10px |
| **Blob Size** | Min/max area filters |
| **Detection** | Canny low/high, Gaussian blur |
| **Crop** | Full / Center 9:16 / Follow 9:16 + Preview or Instagram resolution |
| **Color & Text** | 18-color palette, crazy mode, text position/content/font size |
| **Trail** | Fade trail with adjustable length |
| **Centroid** | Show tracking dots |

## Export Formats

| Format | Engine | Resolution | Bitrate | Best for |
|---|---|---|---|---|
| **WebM (Preview)** | MediaRecorder | Canvas size (~540p) | 8 Mbps | Quick previews |
| **MP4 (Preview)** | WebCodecs H.264 | Canvas size (~540p) | 8 Mbps | Desktop playback |
| **MP4 (Instagram)** | WebCodecs H.264 High Profile | **1080×1920** (9:16) | **20 Mbps** | Instagram Reels |
| **WebM (Instagram)** | MediaRecorder | **1080×1920** (9:16) | 8 Mbps | Instagram (may need conversion) |

### Instagram Reels Setup

For best Instagram Reels results:

1. Set **Crop → Center 9:16** (static) or **Follow 9:16** (tracks first blob)
2. Set **Mode → Instagram** (outputs 1080×1920)
3. Export as **MP4** — encoded with H.264 High Profile @ 20 Mbps
4. File saves as `contour_vfx_reels.mp4`, ready to upload

Instagram Reels specs: 1080×1920, H.264, 30fps, max 90 seconds.

## Known Limitations

- **Contour tracking, not object tracking** — IDs flicker between frames, that's expected
- **MP4 export requires Chrome/Edge** — WebCodecs API not available in Firefox/Safari
- **Preview resolution is ~540p** — full-res export only via Instagram mode or Streamlit version (`app.py`)
- **OpenCV.js loads from CDN** — needs internet on first load
