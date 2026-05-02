import numpy as np
import cv2
from processing.detection import BlobRecord
from processing.rendering import draw_fill_layer


def _make_blob():
    contour = np.array(
        [[[60, 60]], [[140, 60]], [[140, 140]], [[60, 140]]], dtype=np.int32
    )
    return BlobRecord(
        centroid=(100, 100), area=6400, bbox=(60, 60, 80, 80), contour=contour, id=0
    )


def test_draw_fill_blends_color_into_blob_interior():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    blob = _make_blob()

    out = draw_fill_layer(frame, [blob], color=(0, 0, 255), opacity=0.5)

    # Interior pixel (100,100) should have ~half-strength red
    r = out[100, 100, 2]
    assert 100 < r < 160
    # Outside (10,10) untouched
    assert out[10, 10, 2] == 0