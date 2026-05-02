import numpy as np
import cv2
from processing.detection import detect_contours


def test_detect_contours_finds_white_square_on_black():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    cv2.rectangle(frame, (60, 60), (140, 140), (255, 255, 255), -1)

    contours = detect_contours(
        frame,
        canny_low=50, canny_high=150,
        min_blob_size=100, max_blob_size=10_000,
        blur_kernel=3,
    )

    assert len(contours) == 1
    area = cv2.contourArea(contours[0])
    assert 5000 < area < 7000  # ~80x80 = 6400


def test_detect_contours_filters_small_blobs():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    cv2.rectangle(frame, (10, 10), (15, 15), (255, 255, 255), -1)  # 5x5 = 25
    cv2.rectangle(frame, (60, 60), (140, 140), (255, 255, 255), -1)  # 80x80

    contours = detect_contours(
        frame,
        canny_low=50, canny_high=150,
        min_blob_size=100, max_blob_size=10_000,
        blur_kernel=3,
    )
    assert len(contours) == 1


def test_detect_contours_filters_large_blobs():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    cv2.rectangle(frame, (10, 10), (190, 190), (255, 255, 255), -1)  # huge

    contours = detect_contours(
        frame,
        canny_low=50, canny_high=150,
        min_blob_size=100, max_blob_size=1000,
        blur_kernel=3,
    )
    assert len(contours) == 0


import pytest
from processing.detection import BlobRecord, CentroidTracker, contours_to_blobs


def test_detect_contours_rejects_inverted_canny_thresholds():
    frame = np.zeros((100, 100, 3), dtype=np.uint8)
    with pytest.raises(ValueError, match="canny_low"):
        detect_contours(
            frame,
            canny_low=200, canny_high=100,
            min_blob_size=10, max_blob_size=10000,
            blur_kernel=3,
        )


def test_detect_contours_rejects_inverted_size_bounds():
    frame = np.zeros((100, 100, 3), dtype=np.uint8)
    with pytest.raises(ValueError, match="min_blob_size"):
        detect_contours(
            frame,
            canny_low=50, canny_high=150,
            min_blob_size=5000, max_blob_size=100,
            blur_kernel=3,
        )


def test_contours_to_blobs_computes_attributes():
    frame_shape = (200, 200, 3)
    contour = np.array([[[60, 60]], [[140, 60]], [[140, 140]], [[60, 140]]], dtype=np.int32)

    blobs = contours_to_blobs([contour], frame_shape=frame_shape)

    assert len(blobs) == 1
    b = blobs[0]
    assert isinstance(b, BlobRecord)
    assert b.area == 6400
    assert b.centroid == (100, 100)
    assert b.bbox == (60, 60, 81, 81)


def test_centroid_tracker_keeps_id_for_close_blob():
    tracker = CentroidTracker(frame_diagonal=300.0)  # max_distance = 15
    b1 = BlobRecord(centroid=(100, 100), area=50, bbox=(95, 95, 10, 10), contour=None, id=None)
    b2 = BlobRecord(centroid=(105, 105), area=50, bbox=(100, 100, 10, 10), contour=None, id=None)

    [tracked1] = tracker.update([b1])
    [tracked2] = tracker.update([b2])

    assert tracked1.id == tracked2.id == 0


def test_centroid_tracker_assigns_new_id_for_far_blob():
    tracker = CentroidTracker(frame_diagonal=300.0)  # max_distance = 15
    b1 = BlobRecord(centroid=(100, 100), area=50, bbox=(95, 95, 10, 10), contour=None, id=None)
    b2 = BlobRecord(centroid=(200, 200), area=50, bbox=(195, 195, 10, 10), contour=None, id=None)

    [tracked1] = tracker.update([b1])
    [tracked2] = tracker.update([b2])

    assert tracked1.id == 0
    assert tracked2.id == 1
