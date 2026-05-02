import numpy as np
import cv2
from processing.detection import BlobRecord
from processing.rendering import TrailRenderer


def test_trail_renderer_decays_over_time():
    renderer = TrailRenderer(
        shape=(200, 200, 3),
        decay=0.5,  # heavy decay for visible test
        color=(0, 0, 255),
        thickness=2,
    )

    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    b1 = BlobRecord(centroid=(50, 100), area=10, bbox=(45, 95, 10, 10), contour=None, id=0)
    b2 = BlobRecord(centroid=(60, 100), area=10, bbox=(55, 95, 10, 10), contour=None, id=0)

    # First, establish a previous centroid by drawing a frame with b1
    renderer.draw(frame, [b1])
    
    # Now draw a line from b1's position to b2's position
    out1 = renderer.draw(frame, [b2])
    
    # Check the overlay at the line drawn between b1 and b2
    # The line was drawn from (50,100) to (60,100), so check somewhere along that line
    val_just_drawn = renderer.overlay[100, 55, 2]  # red value at midpoint of the line
    
    # Now move away from that area repeatedly to let the trail decay
    b3 = BlobRecord(centroid=(100, 150), area=10, bbox=(95, 145, 10, 10), contour=None, id=0)
    for _ in range(5):
        renderer.draw(frame, [b3])
        
    # Check that the trail has decayed significantly
    val_after_decay = renderer.overlay[100, 55, 2]
    
    # The value should be significantly lower after multiple decay iterations
    assert val_after_decay < val_just_drawn