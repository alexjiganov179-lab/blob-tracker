import numpy as np
import cv2
from processing.detection import BlobRecord
from processing.rendering import draw_bbox_layer


def _make_blob():
    contour = np.array(
        [[[60, 60]], [[140, 60]], [[140, 140]], [[60, 140]]], dtype=np.int32
    )
    return BlobRecord(
        centroid=(100, 100), area=6400, bbox=(60, 60, 80, 80), contour=contour, id=0
    )


def test_draw_bbox_marks_all_four_edges():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    blob = _make_blob()

    out = draw_bbox_layer(frame, [blob], color=(255, 0, 0), thickness=2)

    # bbox is (60, 60, 80, 80)
    assert out[60, 100, 0] > 0   # top edge has blue
    assert out[140, 100, 0] > 0  # bottom edge
    assert out[100, 60, 0] > 0   # left
    assert out[100, 140, 0] > 0  # right
    assert out[100, 100, 0] == 0  # interior untouched