import numpy as np
import cv2
import pytest
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


def test_centroid_tracker_no_id_reuse_within_frame():
    """Two current blobs near the same previous blob must get different IDs."""
    tracker = CentroidTracker(frame_diagonal=1000.0)  # max_distance = 50

    # Frame 1: one blob at (100, 100)
    p1 = BlobRecord(centroid=(100, 100), area=10, bbox=(95, 95, 10, 10), contour=None, id=None)
    tracker.update([p1])

    # Frame 2: two blobs both within range of (100,100)
    c1 = BlobRecord(centroid=(110, 100), area=10, bbox=(105, 95, 10, 10), contour=None, id=None)
    c2 = BlobRecord(centroid=(105, 100), area=10, bbox=(100, 95, 10, 10), contour=None, id=None)
    tracked = tracker.update([c1, c2])

    ids = {b.id for b in tracked}
    assert len(ids) == 2, f"Expected 2 unique IDs, got {ids}"


def test_detect_contours_keeps_tiny_balloon_like_blobs_with_bbox_area():
    frame = np.full((200, 300, 3), (210, 180, 140), dtype=np.uint8)
    cv2.circle(frame, (80, 70), 4, (40, 40, 100), -1, lineType=cv2.LINE_AA)
    cv2.circle(frame, (160, 90), 5, (45, 70, 80), -1, lineType=cv2.LINE_AA)

    contours = detect_contours(
        frame,
        canny_low=30, canny_high=100,
        min_blob_size=100, max_blob_size=5_000,
        blur_kernel=3,
    )

    assert len(contours) == 2


def test_detect_contours_detail_mode_keeps_nearby_fragments_separate():
    frame = np.zeros((180, 240, 3), dtype=np.uint8)
    cv2.rectangle(frame, (40, 60), (80, 100), (255, 255, 255), -1)
    cv2.rectangle(frame, (100, 60), (140, 100), (255, 255, 255), -1)

    contours = detect_contours(
        frame,
        canny_low=50, canny_high=150,
        min_blob_size=100, max_blob_size=20_000,
        blur_kernel=3,
        grouping_mode="contours",
        merge_kernel=21,
        merge_iterations=1,
    )

    assert len(contours) == 2


def test_detect_contours_regions_mode_merges_nearby_fragments_into_one_region():
    frame = np.zeros((180, 240, 3), dtype=np.uint8)
    cv2.rectangle(frame, (40, 60), (80, 100), (255, 255, 255), -1)
    cv2.rectangle(frame, (100, 60), (140, 100), (255, 255, 255), -1)

    contours = detect_contours(
        frame,
        canny_low=50, canny_high=150,
        min_blob_size=100, max_blob_size=20_000,
        blur_kernel=3,
        grouping_mode="regions",
        merge_kernel=21,
        merge_iterations=1,
    )

    assert len(contours) == 1
    x, y, w, h = cv2.boundingRect(contours[0])
    assert x <= 40
    assert x + w >= 140


def test_detect_contours_regions_mode_keeps_distant_groups_separate():
    frame = np.zeros((180, 300, 3), dtype=np.uint8)
    cv2.rectangle(frame, (30, 60), (70, 100), (255, 255, 255), -1)
    cv2.rectangle(frame, (210, 60), (250, 100), (255, 255, 255), -1)

    contours = detect_contours(
        frame,
        canny_low=50, canny_high=150,
        min_blob_size=100, max_blob_size=20_000,
        blur_kernel=3,
        grouping_mode="regions",
        merge_kernel=21,
        merge_iterations=1,
    )

    assert len(contours) == 2


def test_detect_contours_rejects_invalid_grouping_mode():
    frame = np.zeros((100, 100, 3), dtype=np.uint8)

    with pytest.raises(ValueError, match="grouping_mode"):
        detect_contours(
            frame,
            canny_low=50, canny_high=150,
            min_blob_size=10, max_blob_size=10_000,
            blur_kernel=3,
            grouping_mode="unknown",
        )


def test_detect_contours_rejects_invalid_merge_kernel():
    frame = np.zeros((100, 100, 3), dtype=np.uint8)

    with pytest.raises(ValueError, match="merge_kernel"):
        detect_contours(
            frame,
            canny_low=50, canny_high=150,
            min_blob_size=10, max_blob_size=10_000,
            blur_kernel=3,
            grouping_mode="regions",
            merge_kernel=0,
        )
