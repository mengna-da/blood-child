// ============================================================================
// 3D TEXT FOR DOME PROJECTION (Camera-Relative Positioning)
// ============================================================================
// Text is positioned relative to camera so it appears at fixed positions 
// in the dome view regardless of camera movement
//
// Usage:
//   import { setup3DText, update3DTextPositions, animate3DText, TEXT_3D_CONTENT } from './domeText.js';
//   
//   // In init():
//   setup3DText(THREE, scene, camera);
//   
//   // In render loop:
//   update3DTextPositions(camera);
//   
//   // When changing steps:
//   animate3DText(step, gsap);
// ============================================================================

import * as THREE from 'three';
import gsap from 'gsap';

// ============================================================================
// TEXT CONTENT CONFIGURATION
// ============================================================================
// Parameters:
//   text: string - The text to display
//   angle: number (0-90) - Degrees from center (0=center, 90=edge of dome)
//   rotation: number (0-360) - Position around dome (0=top, 90=right, 180=bottom, 270=left)
//   distance: number - Distance from camera (affects apparent size) 200=close, 400=medium, 600=far
//   scale: number (optional) - Size multiplier (default: 1.0)
//   fontSize: number (optional) - Font size in pixels (default: 52)
//   flip: boolean (optional) - Rotate 180° for upside-down text (default: false)
//   tilt: number (optional) - Additional rotation in degrees (default: 0)

//                     rotation: 0° (TOP)
//                          ↑
//                          |
//                     _____|_____
//                  /       |       \
//                /    angle: 30°    \
//               /          |          \
//  rotation:   |     angle: 60°       |   rotation:
//  270° (LEFT) |           |           |   90° (RIGHT)
//               \    angle: 90° ←edge  /
//                \         |         /
//                  \_______|_______/
//                          |
//                          ↓
//                  rotation: 180° (BOTTOM)

// Angle:
// ┌─────────────────────┐
// │   ┌─────────────┐   │  ← 90° (edge)
// │   │   ┌─────┐   │   │  ← 60°
// │   │   │  •  │   │   │  ← 30° (• = center, 0°)
// │   │   └─────┘   │   │
// │   └─────────────┘   │
// └─────────────────────┘

// Rotation:
//                     0° / 360°
//                       (TOP)
//                         ↑
//            315°         |         45°
//               ↖         |         ↗
//                         |
//   270° (LEFT) ←─────────●─────────→ 90° (RIGHT)
//                         |
//               ↙         |         ↘
//            225°         |         135°
//                         ↓
//                       180°
//                     (BOTTOM)

// // ============================================================================

export const TEXT_3D_CONTENT = {
    text0: [
        { text: "A strange multiplicity of sensations seizes you", angle: 70},
        { text: "A strange multiplicity of sensations seizes you", angle: -70, flip: true}
        // { text: "Metallic smell", angle: 50, rotation: 300 },
        // { text: "Gooey texture", angle: 55, rotation: 60 },
        // { text: "Fermented taste with a tinge of sea", angle: 60, rotation: 180 }
    ],
    text1: [
        // { text: "You come out", angle: 0},
        { text: "You come out like a river breaking its dam", angle: 70},
        { text: "You come out like tides under the full moon", angle: -70, flip: true}
    ],
    text2: [
        { text: "You grow from blood", angle: 70},
        { text: "You grow from blood", angle: -70, flip: true}
    ],
    text3: [
        { text: "They say your blood is filthy, impure, unwanted", angle: 70},
        { text: "They say your blood is filthy, impure, unwanted", angle: -70, flip: true}
    ],
    text4: [
        { text: "You try to flow into the world", angle: 70 },
        { text: "only to receive disgust and aversion", angle: -70, flip: true }
    ],
    text5: [
        { text: "You come from a body that waxes and wanes", angle: 70 },
        { text: "You come from a body that waxes and wanes", angle: -70, flip: true}
        // { text: "that waxes and wanes", angle: 45, rotation: 110 }
    ],
    text6: [
        { text: "You are created from blood under every moon", scale: 4, angle: 10},
        { text: "You are created from blood under every moon", scale: 4, angle: -10, flip: true}
    ],
    text7: [
        // { text: "How do people celebrate life while", angle: 30, rotation: 315 },
        // { text: "simultaneously despising where life comes from?", angle: 40, rotation: 300 },
        { text: "Confusion becomes pain", angle: 70},
        { text: "Confusion becomes pain", angle: -70, flip: true}
    ],
    text8: [
        // { text: "You are let go", angle: 25, rotation: 45 },
        { text: "Pain becomes rage", angle: 70},
        { text: "Pain becomes rage", angle: -70, flip: true}
    ],
    text9: [
        // { text: "You are constantly dying bit by bit", angle: 30, rotation: 300 },
        // { text: "and growing bit by bit", angle: 40, rotation: 330 },
        { text: "Rage becomes clarity", angle: 70},
        { text: "Rage becomes clarity", angle: -70, flip: true}
    ],
    text10: [
        { text: "You are the monster they fear", scale: 3, angle: 20},
        { text: "You are the monster they fear", scale: 3, angle: -20, flip: true}
    ],
    text11: [
        { text: "You are simultaneously the fallen angel and the ascended demon", angle: 70},
        { text: "You are simultaneously the fallen angel and the ascended demon", angle: -70, flip: true}
    ],
    text12: [
        { text: "You are the ultimate other", scale: 4, angle: 10},
        { text: "and the ultimate self", scale: 4, angle: -10, flip: true},
    ],
    text13: [
        { text: "There is nothing but warm, sticky blackness", angle: 70}, 
        { text: "There is nothing but warm, sticky blackness", angle: -70, flip: true}
    ]
};

// ============================================================================
// INTERNAL STATE
// ============================================================================

let textDomeGroup = null; // Group for dome text
let text3DMeshes = {};    // References to text groups by name
let sceneRef = null;      // Reference to Three.js scene
let cameraRef = null;     // Reference to camera

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a canvas texture with text
 * @param {string} text - Text to render
 * @param {number} fontSize - Font size in pixels
 * @param {string} fontFamily - CSS font family
 * @returns {Object} { texture, width, height, textWidth }
 */
function createTextTexture(text, fontSize = 64, fontFamily = 'Balthazar, Georgia, serif') {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // Set font to measure text
    context.font = `${fontSize}px ${fontFamily}`;
    const metrics = context.measureText(text);
    
    // Size canvas to fit text with padding (power of 2 for better GPU performance)
    const padding = 60;
    canvas.width = Math.pow(2, Math.ceil(Math.log2(metrics.width + padding * 2)));
    canvas.height = Math.pow(2, Math.ceil(Math.log2(fontSize * 2 + padding * 2)));
    
    // Clear and set up context again (canvas resize resets context)
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = `${fontSize}px ${fontFamily}`;
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Draw text
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    
    return { texture, width: canvas.width, height: canvas.height, textWidth: metrics.width };
}

/**
 * Convert dome coordinates to 3D position relative to camera
 * @param {number} angle - Degrees from center (0=forward, 90=perpendicular)
 * @param {number} rotation - Degrees around view (0=top, 90=right, 180=bottom, 270=left)
 * @param {number} distance - Distance from camera
 * @returns {THREE.Vector3} Local position offset
 */
function domeToLocalPosition(angle, rotation, distance) {
    const angleRad = THREE.MathUtils.degToRad(angle);
    const rotationRad = THREE.MathUtils.degToRad(rotation - 90); // Adjust so 0° is top
    
    // Spherical to Cartesian conversion
    // In camera local space: -Z is forward, Y is up, X is right
    const z = -Math.cos(angleRad) * distance;
    const radialDist = Math.sin(angleRad) * distance;
    const x = Math.cos(rotationRad) * radialDist;
    const y = Math.sin(rotationRad) * radialDist;
    
    return new THREE.Vector3(x, y, z);
}

/**
 * Create a 3D text mesh for dome projection
 * @param {string} text - Text content
 * @param {number} angle - Degrees from center
 * @param {number} rotation - Degrees around dome
 * @param {number} distance - Distance from camera
 * @param {number} scale - Size multiplier
 * @param {number} fontSize - Font size
 * @param {boolean} flip - Rotate 180° (upside down)
 * @param {number} tilt - Additional rotation in degrees
 * @returns {THREE.Mesh} Text mesh
 */
function createDomeTextMesh(text, angle, rotation=0, distance = 200, scale = 1, fontSize = 72, flip = false, tilt = 0) {
    const { texture, width, height } = createTextTexture(text, fontSize);
    
    // Create plane geometry sized to match text aspect ratio
    const aspectRatio = width / height;
    const planeHeight = 60 * scale;
    const planeWidth = planeHeight * aspectRatio;
    
    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: true,
        opacity: 0
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Store dome coordinates for later positioning
    mesh.userData.domeAngle = angle;
    mesh.userData.domeRotation = rotation;
    mesh.userData.domeDistance = distance;
    mesh.userData.flip = flip;
    mesh.userData.tilt = tilt;
    
    return mesh;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Hide HTML text elements (use 3D text instead)
 * Call this to hide the original HTML text overlay
 */
export function hideHTMLText() {
    // Hide the text container
    const textContainer = document.querySelector('.text-container');
    if (textContainer) {
        textContainer.style.display = 'none';
        console.log('HTML text container hidden');
    }
    
    // Also hide individual text elements (in case container isn't found)
    for (let i = 0; i <= 12; i++) {
        const textEl = document.getElementById(`text${i}`);
        if (textEl) {
            textEl.style.display = 'none';
        }
    }
}

/**
 * Show HTML text elements (restore original)
 */
export function showHTMLText() {
    const textContainer = document.querySelector('.text-container');
    if (textContainer) {
        textContainer.style.display = '';
    }
    
    for (let i = 0; i <= 12; i++) {
        const textEl = document.getElementById(`text${i}`);
        if (textEl) {
            textEl.style.display = '';
        }
    }
    console.log('HTML text container shown');
}

/**
 * Initialize 3D text objects and add to scene
 * @param {THREE.Scene} scene - Three.js scene
 * @param {THREE.Camera} camera - Three.js camera
 * @param {boolean} hideHTML - Whether to hide HTML text elements (default: true)
 */
export function setup3DText(scene, camera, hideHTML = true) {
    sceneRef = scene;
    cameraRef = camera;
    
    // Hide HTML text elements
    if (hideHTML) {
        hideHTMLText();
    }
    
    // Create main group for all dome text
    textDomeGroup = new THREE.Group();
    textDomeGroup.name = 'textDomeGroup';
    scene.add(textDomeGroup);
    
    // Create text groups for each step
    Object.keys(TEXT_3D_CONTENT).forEach(key => {
        const textGroup = new THREE.Group();
        textGroup.name = `${key}_3d`;
        
        TEXT_3D_CONTENT[key].forEach((item, index) => {
            const mesh = createDomeTextMesh(
                item.text,
                item.angle,
                item.rotation,
                item.distance || 300,
                item.scale || 1.0,
                item.fontSize || 52,
                item.flip || false,
                item.tilt || 0
            );
            mesh.name = `${key}_line${index}`;
            textGroup.add(mesh);
        });
        
        textDomeGroup.add(textGroup);
        text3DMeshes[key] = textGroup;
    });
    
    console.log('3D Dome Text initialized with', Object.keys(TEXT_3D_CONTENT).length, 'text groups');
}

/**
 * Update 3D text positions to stay relative to camera and face camera
 * Call this in your render loop
 * @param {THREE.Camera} camera - Three.js camera
 */
export function update3DTextPositions(camera) {
    if (!textDomeGroup) return;
    
    // Get camera's world position and direction
    const cameraPosition = camera.position.clone();
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    cameraDirection.applyQuaternion(camera.quaternion);
    
    // Get camera's up and right vectors
    const cameraUp = new THREE.Vector3(0, 1, 0);
    cameraUp.applyQuaternion(camera.quaternion);
    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(cameraDirection, cameraUp).normalize();
    
    // Update each text mesh position
    textDomeGroup.children.forEach(group => {
        group.children.forEach(mesh => {
            const angle = mesh.userData.domeAngle;
            const rotation = mesh.userData.domeRotation;
            const distance = mesh.userData.domeDistance;
            const flip = mesh.userData.flip || false;
            const tilt = mesh.userData.tilt || 0;
            
            // Calculate local offset in camera space
            const localPos = domeToLocalPosition(angle, rotation, distance);
            
            // Transform to world position using camera orientation
            const worldPos = cameraPosition.clone();
            worldPos.add(cameraRight.clone().multiplyScalar(localPos.x));
            worldPos.add(cameraUp.clone().multiplyScalar(localPos.y));
            worldPos.add(cameraDirection.clone().multiplyScalar(-localPos.z));
            
            mesh.position.copy(worldPos);
            
            // Make text face the camera
            mesh.lookAt(cameraPosition);
            
            // Apply flip (upside down) and tilt rotation AFTER lookAt
            if (flip) {
                mesh.rotation.z += Math.PI; // 180° = upside down
            }
            if (tilt !== 0) {
                mesh.rotation.z += THREE.MathUtils.degToRad(tilt);
            }
        });
    });
}

/**
 * Animate 3D text opacity for a specific step
 * @param {number} step - Current step number (0, 1, 2, etc.)
 */
export function animate3DText(step) {
    Object.keys(text3DMeshes).forEach(key => {
        const group = text3DMeshes[key];
        if (!group) return;
        
        // Extract step number from key (e.g., "text0" -> 0)
        const textStep = parseInt(key.replace('text', ''));
        const shouldShow = step === textStep;
        
        group.children.forEach((mesh, index) => {
            gsap.to(mesh.material, {
                opacity: shouldShow ? 1 : 0,
                duration: 1,
                delay: shouldShow ? index * 0.15 : 0,
                ease: "power2.inOut"
            });
        });
    });
}

/**
 * Get reference to the text dome group
 * @returns {THREE.Group|null}
 */
export function getTextDomeGroup() {
    return textDomeGroup;
}

/**
 * Get references to all text meshes
 * @returns {Object}
 */
export function getText3DMeshes() {
    return text3DMeshes;
}

