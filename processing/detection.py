"""Contour detection pipeline: blur → Canny → findContours → size filter."""
from __future__ import annotations

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
