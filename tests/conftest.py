import cv2
import numpy as np
import pytest
from pathlib import Path


@pytest.fixture
def synthetic_video(tmp_path):
    """Generate a 2-second 480x360 video with a moving white square on black bg."""
    path = tmp_path / "synthetic.mp4"
    fps = 30
    width, height = 480, 360
    duration_sec = 2
    n_frames = fps * duration_sec

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(path), fourcc, fps, (width, height))

    for i in range(n_frames):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        # white square moves left to right
        x = int((i / n_frames) * (width - 80))
        cv2.rectangle(frame, (x, 140), (x + 80, 220), (255, 255, 255), -1)
        writer.write(frame)

    writer.release()
    assert path.exists() and path.stat().st_size > 0
    return path


@pytest.fixture
def synthetic_video_with_audio(tmp_path, synthetic_video):
    """Same as synthetic_video but with a silent audio track muxed in via ffmpeg."""
    import subprocess
    out = tmp_path / "synthetic_audio.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(synthetic_video),
            "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-c:v", "copy", "-c:a", "aac", "-shortest",
            str(out),
        ],
        check=True, capture_output=True,
    )
    return out
