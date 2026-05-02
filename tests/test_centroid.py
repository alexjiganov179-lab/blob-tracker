import numpy as np
import cv2
from processing.detection import BlobRecord
from processing.rendering import draw_centroid_layer


def _make_blob():
    contour = np.array(
        [[[60, 60]], [[140, 60]], [[140, 140]], [[60, 140]]], dtype=np.int32
    )
    return BlobRecord(
        centroid=(100, 100), area=6400, bbox=(60, 60, 80, 80), contour=contour, id=0
    )


def test_draw_centroid_marks_centroid_pixel():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    blob = _make_blob()

    out = draw_centroid_layer(frame, [blob], color=(0, 255, 255), radius=5)

    # centroid at (100,100); cv2 uses BGR, so yellow = (0,255,255)
    assert out[100, 100, 1] > 0  # green
    assert out[100, 100, 2] > 0  # red
    assert out[100, 100, 0] == 0  # blue zero