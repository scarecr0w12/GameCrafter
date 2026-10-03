# Lantern Workshop design fixture

This is a disposable tutorial Project for learning PlayWeld, not production game canon.

The player moves a green light around a small room with the arrow keys. Three lanterns wait in fixed positions. Touching a lantern collects it exactly once and increases the visible counter. Collecting all three displays a completion message. Pressing R restores the initial positions and resets the counter. The scene uses drawn shapes and the Godot default font; it needs no imported or licensed art.

The collection radius is 26 pixels. The player travels at 240 pixels per second and stays inside the viewport. Resetting also moves the player back to the starting position. Changes to these rules belong in this document alongside the code change.

Acceptance: collect all three lanterns, confirm the counter reaches 3/3 without double counting, press R, and confirm 0/3 and the original player/lantern positions. Run the same check with arrow keys held against the room boundary. Capture the engine version and actual test outcome separately from a Control Room screenshot.
