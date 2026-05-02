import numpy as np
import cv2
from processing.detection import BlobRecord
from processing.rendering import draw_contour_layer


def _make_blob():
    contour = np.array(
        [[[60, 60]], [[140, 60]], [[140, 140]], [[60, 140]]], dtype=np.int32
    )
    return BlobRecord(
        centroid=(100, 100), area=6400, bbox=(60, 60, 80, 80), contour=contour, id=0
    )


def test_draw_contour_modifies_pixels_at_edge():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    blob = _make_blob()

    out = draw_contour_layer(
        frame, [blob],
        color=(0, 255, 0), thickness=2,
        epsilon_ratio=0.0, use_convex_hull=False,
    )

    assert out[60, 100, 1] > 0  # green channel set on top edge
    assert out[100, 100, 1] == 0  # interior untouched


def test_draw_contour_disabled_returns_unchanged():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    out = draw_contour_layer(
        frame, [],
        color=(0, 255, 0), thickness=2,
        epsilon_ratio=0.0, use_convex_hull=False,
    )
    assert np.array_equal(out, frame)