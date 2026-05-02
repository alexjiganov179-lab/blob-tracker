import numpy as np
import cv2
from processing.detection import BlobRecord
from processing.rendering import draw_labels_layer


def _make_blob():
    contour = np.array(
        [[[60, 60]], [[140, 60]], [[140, 140]], [[60, 140]]], dtype=np.int32
    )
    return BlobRecord(
        centroid=(100, 100), area=6400, bbox=(60, 60, 80, 80), contour=contour, id=0
    )


def test_draw_labels_writes_text_when_show_id_enabled():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    blob = _make_blob()

    out = draw_labels_layer(
        frame, [blob],
        show_id=True, show_area=False, show_coords=False,
        font_size=12, text_color=(255, 255, 255), bg_color=(0, 0, 0, 0),
    )

    # Some pixels above the bbox should be non-zero (text rendered)
    region = out[40:60, 60:140, :]
    assert region.sum() > 0


def test_draw_labels_disabled_returns_unchanged():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    blob = _make_blob()

    out = draw_labels_layer(
        frame, [blob],
        show_id=False, show_area=False, show_coords=False,
        font_size=12, text_color=(255, 255, 255), bg_color=(0, 0, 0, 0),
    )
    assert np.array_equal(out, frame)