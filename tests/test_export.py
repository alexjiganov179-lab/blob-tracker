import subprocess
import cv2
from processing.export import mux_audio, export_video
from tests.test_pipeline import _default_render_params


def _has_audio(path):
    res = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0",
         "-show_entries", "stream=codec_type", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True,
    )
    return "audio" in res.stdout


def test_mux_audio_preserves_audio_from_source(synthetic_video_with_audio, synthetic_video, tmp_path):
    out = tmp_path / "out.mp4"

    mux_audio(
        video_only=synthetic_video,        # silent
        audio_source=synthetic_video_with_audio,  # has audio
        dst=out,
    )

    assert out.exists()
    assert _has_audio(out)


def test_mux_audio_handles_silent_source(synthetic_video, tmp_path):
    out = tmp_path / "out.mp4"

    mux_audio(
        video_only=synthetic_video,
        audio_source=synthetic_video,  # also silent
        dst=out,
    )

    assert out.exists()
    assert not _has_audio(out)


def test_export_video_produces_9by16_with_audio(synthetic_video_with_audio, tmp_path):
    detection_params = {
        "canny_low": 50, "canny_high": 150,
        "min_blob_size": 100, "max_blob_size": 100_000,
        "blur_kernel": 3,
    }
    out = tmp_path / "final.mp4"

    export_video(
        src=synthetic_video_with_audio,
        dst=out,
        crop_offset=0.0,
        detection_params=detection_params,
        render_params=_default_render_params(),
    )

    assert out.exists()
    cap = cv2.VideoCapture(str(out))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()
    # Source is 480x360 → 9:16 crop = 202x360
    assert h == 360
    assert abs(w - int(360 * 9 / 16)) <= 2
    assert _has_audio(out)