Dome Text Positioning: { text, angle, rotation, distance }

Imagine you're sitting inside a dome planetarium, looking straight ahead at the center of the dome.

Visual Reference
                    rotation: 0° (TOP)
                         ↑
                         |
                    _____|_____
                 /       |       \
               /    angle: 30°    \
              /          |          \
 rotation:   |     angle: 60°       |   rotation:
 270° (LEFT) |           |           |   90° (RIGHT)
              \    angle: 90° ←edge  /
               \         |         /
                 \_______|_______/
                         |
                         ↓
                  rotation: 180° (BOTTOM)
                  

Parameter 1: angle (0° to 90°)
How far from the center of your view the text appears.
Angle	Position	Description
0°	Dead center	Looking straight ahead
30°	Inner area	Comfortable reading zone
45°	Mid-ring	Noticeable off-center
60°	Outer area	Peripheral vision
75°	Near edge	Strong fisheye distortion
90°	At the edge	Exactly on the dome circle boundary

Think of it like a bullseye target:
        ┌─────────────────────┐
        │   ┌─────────────┐   │  ← 90° (edge)
        │   │   ┌─────┐   │   │  ← 60°
        │   │   │  •  │   │   │  ← 30° (• = center, 0°)
        │   │   └─────┘   │   │
        │   └─────────────┘   │
        └─────────────────────┘

Parameter 2: rotation (0° to 360°)
Where around the circle the text is positioned.
                    0° / 360°
                      (TOP)
                        ↑
           315°         |         45°
              ↖         |         ↗
                        |
  270° (LEFT) ←─────────●─────────→ 90° (RIGHT)
                        |
              ↙         |         ↘
           225°         |         135°
                        ↓
                      180°
                    (BOTTOM)

Rotation	Position
0°	Top center
45°	Upper-right
90°	Right side
135°	Lower-right
180°	Bottom center
225°	Lower-left
270°	Left side
315°	Upper-left


Parameter 3: distance (in units)
How far from the camera the text is placed.
This affects:
Apparent size: Closer = larger text, further = smaller
Depth: Closer text may overlap with 3D objects

Distance	Effect
200	Close, large text
400	Medium (current default)
600	Far, smaller text
