// ============================================================================
// 3D TEXT FOR DOME PROJECTION - UNBORN PAGE
// ============================================================================
// Text is positioned relative to camera so it appears at fixed positions 
// in the dome view regardless of camera movement.
// 
// Adapted for unborn page which has:
//   - Scene 1 (text1-text6): Tube travel, text fades based on scroll percentage
//   - Scene 2 (text7-text13): Sphere exploration, text changes on wheel events
//
// Usage:
//   import { setup3DText, update3DTextPositions, animate3DTextByPercentage, animate3DTextByStep } from './unbornTextForDome.js';
//   
//   // After scene/camera setup:
//   setup3DText(scene, camera);
//   
//   // In render loop:
//   update3DTextPositions(camera);
//   
//   // During Scene 1 (tube travel):
//   animate3DTextByPercentage(tubePercent);
//   
//   // During Scene 2 (sphere):
//   animate3DTextByStep(scene2Step);  // 0-5 maps to text7-text13
// ============================================================================

import * as THREE from 'three';
import gsap from 'gsap';

// ============================================================================
// TEXT CONTENT CONFIGURATION
// ============================================================================
// Parameters:
//   text: string - The text to display
//   angle: number - Degrees from center (0=center, 90=edge of dome, negative for bottom)
//   rotation: number (0-360) - Position around dome (0=top, 90=right, 180=bottom, 270=left)
//   distance: number - Distance from camera (affects apparent size)
//   scale: number (optional) - Size multiplier (default: 1.0)
//   fontSize: number (optional) - Font size in pixels (default: 52)
//   flip: boolean (optional) - Rotate 180° for upside-down text (default: false)
//   tilt: number (optional) - Additional rotation in degrees (default: 0)

export const TEXT_3D_CONTENT = {
    // ========== SCENE 1: TUBE TRAVEL (text1-text6) ==========
    // Note: Camera far plane is 200, tube radius is 5, so keep distance small (3-10)
    text1: [
        { text: "You go back into your unbirth", angle: 70, distance:5, scale: .04 },
        { text: "You go back into your unbirth", angle: -70, flip: true, distance:5, scale: .04 }
    ],
    text2: [
        { text: "Go back at the same speed as you were", angle: 70, distance:5, scale: .04 },
        { text: "released from the body that was once your home", angle: -70, flip: true, distance:5, scale: .04 },
    ],
    text3: [
        { text: "You are hugged by incredible warmth", angle: 65, distance:5, scale: .04 },
        { text: "Sticky softness that nothing can penetrate", angle: 70, distance:5, scale: .04 },
        { text: "You are hugged by incredible warmth", angle: -65, flip: true, distance:5, scale: .04 },
        { text: "Sticky softness that nothing can penetrate", angle: -70, flip: true, distance:5, scale: .04 }
    ],
    text4: [
        { text: "You were once part of the warmth", angle: 10, distance:5, scale: .15 },
        { text: "You were once part of the warmth", angle: -10, flip: true, distance:5, scale: .15 }
    ],
    text5: [
        { text: "You were once the bed of lining", angle: 65, distance:5, scale: .04 },
        { text: "where new lives land", angle: 70, distance:5, scale: .04 },
        { text: "You were once the bed of lining", angle: -65, flip: true, distance:5, scale: .04 },
        { text: "where new lives land", angle: -70, flip: true, distance:5, scale: .04 }
    ],
    text6: [
        { text: "It feels nostalgic", angle: 10, scale: .2, distance: 5 },
        { text: "It feels nostalgic", angle: -10, scale: .2, flip: true, distance: 5 }
    ],
    
    // ========== SCENE 2: SPHERE EXPLORATION (text7-text13) ==========
    // Note: Scene 2 is in open space with sphere, can use larger distances (50-100)
    text7: [
        { text: "People call you bleeding monster", angle: 65, flip: true, distance: 110},
        { text: "but you know you are the fallen angel", angle: 70, flip: true, distance: 110 },
        { text: "falling from the paradise that is supposed to birth all", angle: -70, flip: true, distance: 110 }
    ],
    text8: [
        { text: "You are death, decaying every month every minute", angle: 70, flip: true, distance: 110 },
        { text: "You are death, decaying every month every minute", angle: -70, flip: true, distance: 110 }
    ],
    text9: [
        { text: "You are life growing every month every minute", angle: 70, flip: true, distance: 110 },
        { text: "You are life growing every month every minute", angle: -70, flip: true, distance: 110 }
    ],
    text10: [
        { text: "Now you're back to where you fall from", angle: 65, distance: 110 },
        { text: "you become unborn undead nonexistent", angle: 70, distance: 110 },
        { text: "Now you're back to where you fall from", angle: -65, flip: true, distance: 110 },
        { text: "you become unborn undead nonexistent", angle: -70, flip: true, distance: 110 },
    ],
    text11: [
        { text: "You are as immortal as you are mortal", angle: 65, distance: 110 },
        { text: "as alive as you are dead", angle: 70, distance: 110 },
        { text: "You are as immortal as you are mortal", angle: -65, flip: true, distance: 110 },
        { text: "as alive as you are dead", angle: -70, flip: true, distance: 110 }
    ],
    text12: [
        { text: "There is nothing but warm, sticky blackness", angle: 70, distance: 110 },
        { text: "There is nothing but warm, sticky blackness", angle: -70, flip: true, distance: 110 }
    ],
    text13: [
        { text: "You want to be born", angle: 10, scale: 2, distance: 30 },
        { text: "You want to be born", angle: -10, scale: 2, flip: true, distance: 30 }
    ]
};

// Scene 1 text keys (for percentage-based animation)
const SCENE1_TEXTS = ['text1', 'text2', 'text3', 'text4', 'text5', 'text6'];
// Scene 2 text keys (for step-based animation)
const SCENE2_TEXTS = ['text7', 'text8', 'text9', 'text10', 'text11', 'text12', 'text13'];

// ============================================================================
// INTERNAL STATE
// ============================================================================

let textDomeGroup = null; // Group for dome text
let text3DMeshes = {};    // References to text groups by name
let sceneRef = null;      // Reference to Three.js scene
let cameraRef = null;     // Reference to camera
let currentScene1TextIndex = -1; // Track which Scene 1 text is showing

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
    
    // Size canvas to fit text with generous padding
    // Use actual text width plus padding, no power-of-2 rounding to avoid clipping
    const padding = 500;
    const textWidth = metrics.width;
    
    // Ensure canvas is at least as wide as the text + padding
    // Cap at 4096 to stay within WebGL texture limits
    canvas.width = Math.min(4096, Math.ceil(textWidth + padding * 2));
    canvas.height = Math.ceil(fontSize * 2.5 + padding);
    
    // Clear and set up context again (canvas resize resets context)
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = `${fontSize}px ${fontFamily}`;
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Draw text at center
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    
    return { texture, width: canvas.width, height: canvas.height, textWidth: textWidth };
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
 */
function createDomeTextMesh(text, angle, rotation = 0, distance = 5, scale = 1, fontSize = 72, flip = false, tilt = 0) {
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
 */
export function hideHTMLText() {
    const textContainer = document.querySelector('.text-container');
    if (textContainer) {
        textContainer.style.display = 'none';
        console.log('HTML text container hidden');
    }
    
    // Also hide individual text elements
    for (let i = 1; i <= 13; i++) {
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
    
    for (let i = 1; i <= 13; i++) {
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
                item.rotation || 0,
                item.distance || 50,  // Default 50, keep under camera far plane (200)
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
    
    // Get camera's WORLD position (important when camera is in a group)
    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);
    
    // Get camera's world quaternion
    const cameraQuaternion = new THREE.Quaternion();
    camera.getWorldQuaternion(cameraQuaternion);
    
    // Calculate camera direction, up, and right vectors from world quaternion
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    cameraDirection.applyQuaternion(cameraQuaternion);
    
    const cameraUp = new THREE.Vector3(0, 1, 0);
    cameraUp.applyQuaternion(cameraQuaternion);
    
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
 * Animate 3D text based on tube travel percentage (Scene 1)
 * @param {number} percent - Current tube percentage (0 to ~0.96)
 */
export function animate3DTextByPercentage(percent) {
    const numTexts = SCENE1_TEXTS.length;
    const segmentSize = 1 / numTexts;
    
    SCENE1_TEXTS.forEach((key, index) => {
        const group = text3DMeshes[key];
        if (!group) return;
        
        const textStart = index * segmentSize;
        const textEnd = textStart + segmentSize;
        
        let targetOpacity = 0;
        
        if (percent >= textStart && percent < textEnd) {
            // Calculate how far we are into this segment (0 to 1)
            const segmentProgress = (percent - textStart) / segmentSize;
            
            // Fade in during first 20% of segment, fade out during last 20%
            if (segmentProgress < 0.2) {
                targetOpacity = segmentProgress / 0.2; // Fade in
            } else if (segmentProgress > 0.8) {
                targetOpacity = 1 - ((segmentProgress - 0.8) / 0.2); // Fade out
            } else {
                targetOpacity = 1;
            }
        }
        
        // Apply opacity to all meshes in this text group
        group.children.forEach(mesh => {
            // Use direct assignment for smooth scroll-based updates
            mesh.material.opacity = targetOpacity;
        });
    });
}

/**
 * Animate 3D text for Scene 2 steps (sphere exploration)
 * @param {number} step - Current step (0-5 maps to text7-text13)
 */
export function animate3DTextByStep(step) {
    // First, hide all Scene 1 texts
    SCENE1_TEXTS.forEach(key => {
        const group = text3DMeshes[key];
        if (group) {
            group.children.forEach(mesh => {
                mesh.material.opacity = 0;
            });
        }
    });
    
    // Animate Scene 2 texts
    SCENE2_TEXTS.forEach((key, index) => {
        const group = text3DMeshes[key];
        if (!group) return;
        
        const shouldShow = step === index;
        
        group.children.forEach((mesh, meshIndex) => {
            gsap.to(mesh.material, {
                opacity: shouldShow ? 1 : 0,
                duration: 1,
                delay: shouldShow ? meshIndex * 0.15 : 0,
                ease: "power2.inOut"
            });
        });
    });
}

/**
 * Hide all 3D texts (used during Scene 2 transition)
 */
export function hideAll3DTexts() {
    Object.values(text3DMeshes).forEach(group => {
        if (group) {
            group.children.forEach(mesh => {
                mesh.material.opacity = 0;
            });
        }
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
