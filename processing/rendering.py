"""Visual layer drawing functions. Each `draw_*_layer` returns a new frame."""
from __future__ import annotations

import cv2
import numpy as np

from processing.detection import BlobRecord


def draw_contour_layer(
    frame: np.ndarray,
    blobs: list[BlobRecord],
    *,
    color: tuple[int, int, int],
    thickness: int,
    epsilon_ratio: float,
    use_convex_hull: bool,
) -> np.ndarray:
    """Draw contour outlines onto a copy of `frame`."""
    out = frame.copy()
    for b in blobs:
        if b.contour is None:
            continue
        cnt = b.contour
        if use_convex_hull:
            cnt = cv2.convexHull(cnt)
        if epsilon_ratio > 0:
            eps = epsilon_ratio * cv2.arcLength(cnt, True)
            cnt = cv2.approxPolyDP(cnt, eps, True)
        cv2.drawContours(out, [cnt], -1, color, thickness)
    return out


def draw_fill_layer(
    frame: np.ndarray,
    blobs: list[BlobRecord],
    *,
    color: tuple[int, int, int],
    opacity: float,
) -> np.ndarray:
    """Alpha-blend filled polygons onto a copy of `frame`."""
    if opacity <= 0 or not blobs:
        return frame.copy()
    overlay = frame.copy()
    for b in blobs:
        if b.contour is None:
            continue
        cv2.drawContours(overlay, [b.contour], -1, color, thickness=cv2.FILLED)
    return cv2.addWeighted(overlay, opacity, frame, 1.0 - opacity, 0)


def draw_bbox_layer(
    frame: np.ndarray,
    blobs: list[BlobRecord],
    *,
    color: tuple[int, int, int],
    thickness: int,
) -> np.ndarray:
    out = frame.copy()
    for b in blobs:
        x, y, w, h = b.bbox
        cv2.rectangle(out, (x, y), (x + w, y + h), color, thickness)
    return out


def draw_centroid_layer(
    frame: np.ndarray,
    blobs: list[BlobRecord],
    *,
    color: tuple[int, int, int],
    radius: int,
) -> np.ndarray:
    out = frame.copy()
    for b in blobs:
        cv2.circle(out, b.centroid, radius, color, thickness=-1)
    return out


def draw_labels_layer(
    frame: np.ndarray,
    blobs: list[BlobRecord],
    *,
    show_id: bool,
    show_area: bool,
    show_coords: bool,
    font_size: int,
    text_color: tuple[int, int, int],
    bg_color: tuple[int, int, int, int],  # BGRA
) -> np.ndarray:
    if not (show_id or show_area or show_coords):
        return frame.copy()

    out = frame.copy()
    font = cv2.FONT_HERSHEY_SIMPLEX
    scale = font_size / 24.0  # ~24pt = scale 1.0

    for b in blobs:
        parts = []
        if show_id and b.id is not None:
            parts.append(f"#{b.id}")
        if show_area:
            parts.append(f"a:{int(b.area)}")
        if show_coords:
            parts.append(f"({b.centroid[0]},{b.centroid[1]})")
        if not parts:
            continue
        text = " ".join(parts)

        x, y = b.bbox[0], max(b.bbox[1] - 6, font_size)
        (tw, th), _ = cv2.getTextSize(text, font, scale, 1)

        if bg_color[3] > 0:
            overlay = out.copy()
            cv2.rectangle(
                overlay,
                (x - 2, y - th - 4),
                (x + tw + 2, y + 2),
                bg_color[:3],
                thickness=cv2.FILLED,
            )
            alpha = bg_color[3] / 255.0
            out = cv2.addWeighted(overlay, alpha, out, 1 - alpha, 0)

        cv2.putText(out, text, (x, y), font, scale, text_color, 1, cv2.LINE_AA)

    return out


class TrailRenderer:
    """Stateful per-frame trail renderer using a decaying overlay buffer.

    Maintains a persistent BGR overlay; each frame:
      1. multiply overlay by decay factor (old marks fade)
      2. for each blob with a known previous centroid, draw a line segment
         from previous to current centroid onto the overlay
      3. add the overlay onto the frame (saturating at 255)
    """

    def __init__(
        self,
        shape: tuple[int, int, int],
        *,
        decay: float,
        color: tuple[int, int, int],
        thickness: int,
    ):
        self.overlay = np.zeros(shape, dtype=np.float32)
        self.decay = float(decay)
        self.color = color
        self.thickness = thickness
        self._prev_centroids: dict[int, tuple[int, int]] = {}

    def draw(self, frame: np.ndarray, blobs: list[BlobRecord]) -> np.ndarray:
        # decay
        self.overlay *= self.decay

        # add new line segments
        new_centroids: dict[int, tuple[int, int]] = {}
        for b in blobs:
            if b.id is None:
                continue
            prev = self._prev_centroids.get(b.id)
            if prev is not None:
                cv2.line(self.overlay, prev, b.centroid, self.color, self.thickness)
            new_centroids[b.id] = b.centroid
        self._prev_centroids = new_centroids

        # composite (additive, clipped)
        out = frame.astype(np.float32) + self.overlay
        return np.clip(out, 0, 255).astype(np.uint8)

    @staticmethod
    def decay_from_length(length_frames: int) -> float:
        """Convert UI 'trail length' (frames) into a per-frame decay factor."""
        return float(np.exp(-1.0 / max(1, length_frames)))


def render_frame(
    frame: np.ndarray,
    blobs: list[BlobRecord],
    params: dict,
    *,
    trail_renderer: TrailRenderer,
) -> np.ndarray:
    """Apply enabled layers in canonical order: fill → contour → bbox → trail → centroid → labels."""
    out = frame

    if params["fill"].get("enabled"):
        p = params["fill"]
        out = draw_fill_layer(out, blobs, color=p["color"], opacity=p["opacity"])

    if params["contour"].get("enabled"):
        p = params["contour"]
        # Handle per-ID color cycling for Glitch preset
        if p.get("color_cycle_per_id", False):
            for b in blobs:
                if b.id is not None:
                    # Generate color based on ID (simple algorithm)
                    r = (b.id * 123) % 256
                    g = (b.id * 231) % 256
                    bb = (b.id * 312) % 256
                    color = (int(r), int(g), int(bb))
                    # Draw contour for this specific blob
                    single_blob_out = draw_contour_layer(
                        out, [b],
                        color=color, thickness=p["thickness"],
                        epsilon_ratio=p["epsilon_ratio"], use_convex_hull=p["use_convex_hull"],
                    )
                    # Blend this back into the output
                    mask = (single_blob_out != out).any(axis=2)
                    out[mask] = single_blob_out[mask]
        else:
            out = draw_contour_layer(
                out, blobs,
                color=p["color"], thickness=p["thickness"],
                epsilon_ratio=p["epsilon_ratio"], use_convex_hull=p["use_convex_hull"],
            )

    if params["bbox"].get("enabled"):
        p = params["bbox"]
        out = draw_bbox_layer(out, blobs, color=p["color"], thickness=p["thickness"])

    if params["trail"].get("enabled"):
        # Handle per-ID color cycling for trails
        if params["contour"].get("color_cycle_per_id", False):
            # For each blob, draw its trail with its own color
            for b in blobs:
                if b.id is not None:
                    # Generate color based on ID (same algorithm as contour)
                    r = (b.id * 123) % 256
                    g = (b.id * 231) % 256
                    bb = (b.id * 312) % 256
                    color = (int(r), int(g), int(bb))
                    
                    # Create a temporary trail renderer for this specific ID
                    temp_trail = TrailRenderer(
                        shape=out.shape,
                        decay=trail_renderer.decay,
                        color=color,
                        thickness=params["trail"]["thickness"]
                    )
                    # Copy the previous centroid state for this ID
                    prev_pos = trail_renderer._prev_centroids.get(b.id)
                    if prev_pos is not None:
                        temp_trail._prev_centroids[b.id] = prev_pos
                    
                    # Draw trail for this blob only
                    out = temp_trail.draw(out, [b])
                    
                    # Update the main trail renderer state
                    trail_renderer._prev_centroids[b.id] = b.centroid
        else:
            out = trail_renderer.draw(out, blobs)
            # Update the trail renderer's state after drawing
            trail_renderer._prev_centroids = {b.id: b.centroid for b in blobs if b.id is not None}
    else:
        # still advance the renderer state so prev_centroids stay current
        trail_renderer._prev_centroids = {b.id: b.centroid for b in blobs if b.id is not None}

    if params["centroid"].get("enabled"):
        p = params["centroid"]
        out = draw_centroid_layer(out, blobs, color=p["color"], radius=p["radius"])

    if params["labels"].get("enabled"):
        p = params["labels"]
        out = draw_labels_layer(
            out, blobs,
            show_id=p["show_id"], show_area=p["show_area"], show_coords=p["show_coords"],
            font_size=p["font_size"], text_color=p["text_color"], bg_color=p["bg_color"],
        )

    return out