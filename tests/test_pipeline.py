from processing.pipeline import detect_blobs_for_clip


def _default_render_params():
    return {
        "contour": {"enabled": True, "color": (0, 255, 0), "thickness": 2,
                    "epsilon_ratio": 0.0, "use_convex_hull": False},
        "fill": {"enabled": False, "color": (0, 0, 255), "opacity": 0.5},
        "bbox": {"enabled": False, "color": (255, 0, 0), "thickness": 2},
        "trail": {"enabled": False, "length_frames": 30, "color": (0, 255, 255), "thickness": 2},
        "centroid": {"enabled": False, "color": (0, 255, 255), "radius": 5},
        "labels": {"enabled": False, "show_id": True, "show_area": False, "show_coords": False,
                   "font_size": 12, "text_color": (255, 255, 255), "bg_color": (0, 0, 0, 0)},
    }


def test_detect_blobs_for_clip_returns_per_frame_lists(synthetic_video):
    detection_params = {
        "canny_low": 50, "canny_high": 150,
        "min_blob_size": 100, "max_blob_size": 100_000,
        "blur_kernel": 3,
    }

    per_frame = detect_blobs_for_clip(synthetic_video, detection_params)

    assert len(per_frame) == 60  # 2 sec * 30 fps
    # The moving square should appear in most frames
    nonempty = sum(1 for blobs in per_frame if len(blobs) > 0)
    assert nonempty > 30
    # IDs are assigned (single moving object should keep same id much of the time)
    ids_seen = {b.id for blobs in per_frame for b in blobs}
    assert len(ids_seen) >= 1