"""Contour detection pipeline: blur → Canny → findContours → size filter."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np


def detect_contours(
    frame: np.ndarray,
    *,
    canny_low: int,
    canny_high: int,
    min_blob_size: float,
    max_blob_size: float,
    blur_kernel: int,
) -> list[np.ndarray]:
    """Detect contours in a single BGR frame.

    Returns a list of contours (each a numpy array of [x, y] points)
    whose area is within [min_blob_size, max_blob_size].
    """
    if blur_kernel < 1 or blur_kernel % 2 == 0:
        raise ValueError(f"blur_kernel must be odd and >= 1, got {blur_kernel}")
    if canny_low >= canny_high:
        raise ValueError(f"canny_low ({canny_low}) must be < canny_high ({canny_high})")
    if min_blob_size > max_blob_size:
        raise ValueError(
            f"min_blob_size ({min_blob_size}) must be <= max_blob_size ({max_blob_size})"
        )

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (blur_kernel, blur_kernel), 0)
    edges = cv2.Canny(blurred, canny_low, canny_high)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    return [c for c in contours if min_blob_size <= cv2.contourArea(c) <= max_blob_size]


@dataclass
class BlobRecord:
    centroid: tuple[int, int]
    area: float
    bbox: tuple[int, int, int, int]  # x, y, w, h
    contour: Optional[np.ndarray]
    id: Optional[int] = None


def contours_to_blobs(
    contours: list[np.ndarray], *, frame_shape: tuple[int, int, int]
) -> list["BlobRecord"]:
    """Compute centroid, area, and bbox for each contour."""
    blobs: list[BlobRecord] = []
    for c in contours:
        m = cv2.moments(c)
        if m["m00"] == 0:
            x, y, w, h = cv2.boundingRect(c)
            cx, cy = x + w // 2, y + h // 2
        else:
            cx = int(m["m10"] / m["m00"])
            cy = int(m["m01"] / m["m00"])
        x, y, w, h = cv2.boundingRect(c)
        area = float(cv2.contourArea(c))
        blobs.append(BlobRecord(centroid=(cx, cy), area=area, bbox=(x, y, w, h), contour=c))
    return blobs


class CentroidTracker:
    """Simple nearest-centroid ID tracker.

    For each frame, assign each blob the ID of the nearest blob from the
    previous frame within `max_distance`. Otherwise assign a fresh ID.
    """

    def __init__(self, frame_diagonal: float, distance_ratio: float = 0.05):
        self.max_distance = frame_diagonal * distance_ratio
        self._next_id = 0
        self._prev: list[BlobRecord] = []

    def update(self, blobs: list[BlobRecord]) -> list[BlobRecord]:
        consumed: set[int] = set()
        for b in blobs:
            best_idx, best_dist = None, self.max_distance
            for i, p in enumerate(self._prev):
                if i in consumed:
                    continue
                dx = b.centroid[0] - p.centroid[0]
                dy = b.centroid[1] - p.centroid[1]
                d = (dx * dx + dy * dy) ** 0.5
                if d < best_dist:
                    best_dist = d
                    best_idx = i
            if best_idx is None:
                b.id = self._next_id
                self._next_id += 1
            else:
                b.id = self._prev[best_idx].id
                consumed.add(best_idx)
        self._prev = blobs
        return blobs
