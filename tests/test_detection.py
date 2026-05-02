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
