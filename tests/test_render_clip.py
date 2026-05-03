import cv2
from processing.pipeline import render_clip
import numpy as np
from processing.detection import BlobRecord


def _make_blob():
    contour = np.array(
        [[[60, 60]], [[140, 60]], [[140, 140]], [[60, 140]]], dtype=np.int32
    )
    return BlobRecord(
        centroid=(100, 100), area=6400, bbox=(60, 60, 80, 80), contour=contour, id=0
    )


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


def test_render_clip_produces_valid_mp4(synthetic_video, tmp_path):
    blobs = [[_make_blob()] for _ in range(60)]  # 60 frames
    out_path = tmp_path / "rendered.mp4"

    render_clip(
        src=synthetic_video,
        dst=out_path,
        per_frame_blobs=blobs,
        render_params=_default_render_params(),
    )

    assert out_path.exists() and out_path.stat().st_size > 0
    cap = cv2.VideoCapture(str(out_path))
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()
    assert n == 60  # Should have 60 frames