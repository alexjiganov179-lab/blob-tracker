import numpy as np
import cv2
from processing.detection import BlobRecord
from processing.rendering import render_frame, TrailRenderer


def _make_blob():
    contour = np.array(
        [[[60, 60]], [[140, 60]], [[140, 140]], [[60, 140]]], dtype=np.int32
    )
    return BlobRecord(
        centroid=(100, 100), area=6400, bbox=(60, 60, 80, 80), contour=contour, id=0
    )


def test_render_frame_applies_only_enabled_layers():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    blob = _make_blob()
    trail = TrailRenderer(shape=frame.shape, decay=0.9, color=(255, 0, 0), thickness=2)

    params = {
        "contour": {"enabled": True, "color": (0, 255, 0), "thickness": 2,
                    "epsilon_ratio": 0.0, "use_convex_hull": False},
        "fill": {"enabled": False},
        "bbox": {"enabled": False},
        "trail": {"enabled": False},
        "centroid": {"enabled": False},
        "labels": {"enabled": False},
    }
    out = render_frame(frame, [blob], params, trail_renderer=trail)

    # Green from contour present
    assert out[60, 100, 1] > 0
    # Red from any other layer absent
    assert out[60, 100, 2] == 0


def test_render_frame_skips_disabled_layers():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    blob = _make_blob()
    trail = TrailRenderer(shape=frame.shape, decay=0.9, color=(255, 0, 0), thickness=2)

    params = {
        "contour": {"enabled": False},
        "fill": {"enabled": False},
        "bbox": {"enabled": False},
        "trail": {"enabled": False},
        "centroid": {"enabled": False},
        "labels": {"enabled": False},
    }
    out = render_frame(frame, [blob], params, trail_renderer=trail)

    # Frame should be unchanged since all layers are disabled
    assert np.array_equal(out, frame)