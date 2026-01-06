/**
 * Dome Projection Module
 * 
 * Handles 180° fisheye dome projection for planetarium/dome displays.
 * Uses CubeCamera to capture 360° view and custom shader for fisheye conversion.
 * 
 * Keyboard Controls:
 *   D - Toggle dome mode on/off
 *   F - Toggle fullscreen 1:1 aspect ratio
 *   E - Export current frame as PNG
 */

import * as THREE from 'three';

// ============================================================================
// DOME PROJECTION SETTINGS
// ============================================================================

// Configuration
const CUBE_RESOLUTION = 2048; // Resolution for cubemap (use 4096 for final render)
const DOME_FOV = 180; // Field of view in degrees for fisheye (180° for full dome)
const DOME_OUTPUT_RESOLUTION = 4096; // Output resolution for dome master format
const DOME_TARGET_FPS = 30;
const DOME_FRAME_DURATION = 1000 / DOME_TARGET_FPS; // ~33.33ms per frame

// State
let DOME_MODE = false;
let cubeCamera = null;
let cubeRenderTarget = null;
let fisheyeScene = null;
let fisheyeCamera = null;
let fisheyeMesh = null;
let fisheyeMaterial = null;
let domeRenderTarget = null;
let lastFrameTime = 0;
let domeFrameCount = 0;
let fullscreen1to1 = false;

// References to main app objects (set via init)
let mainScene = null;
let mainCamera = null;
let mainRenderer = null;

// ============================================================================
// FISHEYE SHADER
// ============================================================================
// Converts cubemap to 180° angular fisheye (domemaster format)
const FisheyeShader = {
    uniforms: {
        'tCube': { value: null },
        'fov': { value: DOME_FOV }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform samplerCube tCube;
        uniform float fov;
        varying vec2 vUv;
        
        #define PI 3.14159265359
        
        void main() {
            // Convert UV coordinates to centered coordinates (-1 to 1)
            vec2 uv = vUv * 2.0 - 1.0;
            
            // Calculate the distance from center (radius in the fisheye circle)
            float r = length(uv);
            
            // Outside the fisheye circle - render black
            if (r > 1.0) {
                gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                return;
            }
            
            // Calculate the angle from center (theta) and the elevation angle (phi)
            // For 180° fisheye: r=0 is looking forward, r=1 is looking 90° to the side
            float theta = atan(uv.y, uv.x); // Azimuth angle
            float phi = r * (fov / 2.0) * PI / 180.0; // Elevation angle based on FOV
            
            // Convert spherical coordinates to 3D direction vector
            // phi=0 looks forward (positive Z), phi=90° looks sideways
            vec3 dir;
            dir.x = sin(phi) * cos(theta);
            dir.y = sin(phi) * sin(theta);
            dir.z = cos(phi);
            
            // Rotate to match Three.js coordinate system
            // Swap y and z, and flip z to look into the scene
            vec3 sampleDir = vec3(dir.x, dir.y, -dir.z);
            
            // Sample the cubemap
            gl_FragColor = textureCube(tCube, sampleDir);
        }
    `
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize dome projection module with references to main app objects
 * @param {THREE.Scene} scene - Main scene
 * @param {THREE.Camera} camera - Main camera
 * @param {THREE.WebGLRenderer} renderer - Main renderer
 */
export function initDomeProjection(scene, camera, renderer) {
    mainScene = scene;
    mainCamera = camera;
    mainRenderer = renderer;
    
    // Set up keyboard controls
    setupDomeKeyboardControls();
    
    // Auto-setup if DOME_MODE is already true
    if (DOME_MODE) {
        setupDomeProjection();
    }
}

/**
 * Set up dome projection rendering pipeline
 */
function setupDomeProjection() {
    // Create CubeRenderTarget for capturing 360° view
    cubeRenderTarget = new THREE.WebGLCubeRenderTarget(CUBE_RESOLUTION, {
        format: THREE.RGBAFormat,
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter
    });

    // Create CubeCamera at the main camera's position
    cubeCamera = new THREE.CubeCamera(1, 10000, cubeRenderTarget);
    mainScene.add(cubeCamera);

    // Create a separate scene for the fisheye output
    fisheyeScene = new THREE.Scene();

    // Orthographic camera for rendering the fisheye quad
    fisheyeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Create fisheye material using the shader
    fisheyeMaterial = new THREE.ShaderMaterial({
        uniforms: {
            tCube: { value: cubeRenderTarget.texture },
            fov: { value: DOME_FOV }
        },
        vertexShader: FisheyeShader.vertexShader,
        fragmentShader: FisheyeShader.fragmentShader,
        side: THREE.DoubleSide
    });

    // Create fullscreen quad to display the fisheye projection
    const fisheyeGeometry = new THREE.PlaneGeometry(2, 2);
    fisheyeMesh = new THREE.Mesh(fisheyeGeometry, fisheyeMaterial);
    fisheyeScene.add(fisheyeMesh);

    // Create high-resolution render target for dome output (4096x4096)
    domeRenderTarget = new THREE.WebGLRenderTarget(DOME_OUTPUT_RESOLUTION, DOME_OUTPUT_RESOLUTION, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType
    });

    console.log('='.repeat(50));
    console.log('DOME PROJECTION MODE INITIALIZED');
    console.log('='.repeat(50));
    console.log('Output Resolution:', DOME_OUTPUT_RESOLUTION + 'x' + DOME_OUTPUT_RESOLUTION);
    console.log('Target FPS:', DOME_TARGET_FPS);
    console.log('Cubemap Resolution:', CUBE_RESOLUTION);
    console.log('');
    console.log('KEYBOARD CONTROLS:');
    console.log('  D - Toggle dome mode on/off');
    console.log('  F - Toggle fullscreen 1:1 aspect ratio');
    console.log('  E - Export current frame as PNG');
    console.log('  R - Start/Stop video recording');
    console.log('  I - Export single high-res frame');
    console.log('  S - Start/Stop image sequence');
    console.log('='.repeat(50));
}

/**
 * Set up keyboard controls for dome mode
 */
function setupDomeKeyboardControls() {
    window.addEventListener('keydown', (e) => {
        // Toggle dome mode
        if (e.key === 'd' || e.key === 'D') {
            DOME_MODE = !DOME_MODE;
            console.log('Dome mode:', DOME_MODE ? 'ON' : 'OFF');
            
            // Initialize dome projection if switching on for the first time
            if (DOME_MODE && !cubeCamera) {
                setupDomeProjection();
            }

            // Reset frame timing when toggling
            lastFrameTime = performance.now();
            domeFrameCount = 0;
        }
        
        // Toggle fullscreen 1:1 aspect ratio for dome preview
        if (e.key === 'f' || e.key === 'F') {
            if (DOME_MODE) {
                fullscreen1to1 = !fullscreen1to1;
                
                if (fullscreen1to1) {
                    // Set canvas to 1:1 aspect ratio (square)
                    const size = Math.min(window.innerWidth, window.innerHeight);
                    mainRenderer.setSize(size, size);
                    mainRenderer.domElement.style.position = 'fixed';
                    mainRenderer.domElement.style.left = ((window.innerWidth - size) / 2) + 'px';
                    mainRenderer.domElement.style.top = ((window.innerHeight - size) / 2) + 'px';
                    mainRenderer.domElement.style.zIndex = '9999';
                    
                    // Hide scrollbars
                    document.body.style.overflow = 'hidden';
                    document.documentElement.style.overflow = 'hidden';
                    
                    // Add black background behind canvas
                    if (!document.getElementById('dome-fullscreen-bg')) {
                        const bg = document.createElement('div');
                        bg.id = 'dome-fullscreen-bg';
                        bg.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#000;z-index:9998;';
                        document.body.appendChild(bg);
                    }
                    
                    // Set up wheel handler that clamps scroll to page bounds
                    if (!window._domeWheelHandler) {
                        window._domeWheelHandler = function(e) {
                            if (fullscreen1to1) {
                                // Calculate max scroll position
                                const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
                                const currentScroll = window.scrollY;
                                const newScroll = Math.max(0, Math.min(maxScroll, currentScroll + e.deltaY));
                                window.scrollTo(0, newScroll);
                            }
                        };
                        window.addEventListener('wheel', window._domeWheelHandler, { passive: true });
                    }
                    
                    console.log('1:1 aspect ratio mode: ON (' + size + 'x' + size + ')');
                } else {
                    // Reset to normal window size
                    mainRenderer.setSize(window.innerWidth, window.innerHeight);
                    mainRenderer.domElement.style.position = '';
                    mainRenderer.domElement.style.left = '';
                    mainRenderer.domElement.style.top = '';
                    mainRenderer.domElement.style.zIndex = '';
                    
                    // Restore scrollbars
                    document.body.style.overflow = '';
                    document.documentElement.style.overflow = '';
                    
                    // Remove black background
                    const bg = document.getElementById('dome-fullscreen-bg');
                    if (bg) bg.remove();
                    
                    console.log('1:1 aspect ratio mode: OFF');
                }
            } else {
                console.log('Enable dome mode first (press D)');
            }
        }
        
        // Export current frame
        if ((e.key === 'e' || e.key === 'E') && DOME_MODE) {
            exportDomeFrame();
        }
    });
}

// ============================================================================
// RENDERING
// ============================================================================

/**
 * Check if current frame should be rendered (for FPS limiting in dome mode)
 * @returns {boolean} - True if frame should be rendered
 */
export function shouldRenderDomeFrame() {
    if (!DOME_MODE) return true;
    
    const currentTime = performance.now();
    const elapsed = currentTime - lastFrameTime;
    
    if (elapsed < DOME_FRAME_DURATION) {
        return false;
    }
    
    // Update timing
    lastFrameTime = currentTime - (elapsed % DOME_FRAME_DURATION);
    domeFrameCount++;
    
    // Log FPS every 30 frames (once per second at 30fps)
    if (domeFrameCount % 30 === 0) {
        console.log('Dome frame:', domeFrameCount, '| Target FPS:', DOME_TARGET_FPS);
    }
    
    return true;
}

/**
 * Render the scene in dome projection mode
 */
export function renderDome() {
    if (!cubeCamera) return;
    
    // Position cube camera at the main camera's WORLD position
    // This is important when camera is nested inside a group (like in unborn)
    mainCamera.getWorldPosition(cubeCamera.position);
    
    // Also copy the camera's world quaternion for proper orientation
    mainCamera.getWorldQuaternion(cubeCamera.quaternion);
    
    // Capture the scene into cubemap
    cubeCamera.update(mainRenderer, mainScene);
    
    // Render the fisheye projection to screen
    mainRenderer.render(fisheyeScene, fisheyeCamera);
}

/**
 * Handle window resize for dome mode
 */
export function onDomeWindowResize() {
    if (DOME_MODE && fisheyeCamera) {
        // Keep 1:1 aspect ratio for dome projection
        fisheyeCamera.left = -1;
        fisheyeCamera.right = 1;
        fisheyeCamera.top = 1;
        fisheyeCamera.bottom = -1;
        fisheyeCamera.updateProjectionMatrix();
    }
}

// ============================================================================
// HIGH-RESOLUTION EXPORT
// ============================================================================

/**
 * Render a single frame at full 4096x4096 resolution
 * @returns {Uint8Array|null} - Pixel data or null if not in dome mode
 */
export function renderDomeFrameHighRes() {
    if (!DOME_MODE || !cubeCamera || !domeRenderTarget) {
        console.error('Dome mode must be enabled first');
        return null;
    }

    // Store original renderer size
    const originalSize = new THREE.Vector2();
    mainRenderer.getSize(originalSize);

    // Set renderer to high resolution
    mainRenderer.setSize(DOME_OUTPUT_RESOLUTION, DOME_OUTPUT_RESOLUTION);

    // Update cube camera with world position
    mainCamera.getWorldPosition(cubeCamera.position);
    mainCamera.getWorldQuaternion(cubeCamera.quaternion);
    cubeCamera.update(mainRenderer, mainScene);

    // Render to the high-res render target
    mainRenderer.setRenderTarget(domeRenderTarget);
    mainRenderer.render(fisheyeScene, fisheyeCamera);
    mainRenderer.setRenderTarget(null);

    // Read pixels from render target
    const pixels = new Uint8Array(DOME_OUTPUT_RESOLUTION * DOME_OUTPUT_RESOLUTION * 4);
    mainRenderer.readRenderTargetPixels(domeRenderTarget, 0, 0, DOME_OUTPUT_RESOLUTION, DOME_OUTPUT_RESOLUTION, pixels);

    // Restore original renderer size
    mainRenderer.setSize(originalSize.x, originalSize.y);

    console.log('Rendered high-res dome frame:', DOME_OUTPUT_RESOLUTION + 'x' + DOME_OUTPUT_RESOLUTION);
    
    return pixels;
}

/**
 * Export a single frame as PNG (downloads to user's computer)
 */
export function exportDomeFrame() {
    if (!DOME_MODE || !cubeCamera) {
        console.error('Dome mode must be enabled first (press D)');
        return;
    }

    // Store original size
    const originalSize = new THREE.Vector2();
    mainRenderer.getSize(originalSize);

    // Set to high resolution
    mainRenderer.setSize(DOME_OUTPUT_RESOLUTION, DOME_OUTPUT_RESOLUTION);

    // Update and render with world position
    mainCamera.getWorldPosition(cubeCamera.position);
    mainCamera.getWorldQuaternion(cubeCamera.quaternion);
    cubeCamera.update(mainRenderer, mainScene);
    mainRenderer.render(fisheyeScene, fisheyeCamera);

    // Export canvas as PNG
    const dataURL = mainRenderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'dome_frame_' + String(domeFrameCount).padStart(6, '0') + '.png';
    link.href = dataURL;
    link.click();

    // Restore original size
    mainRenderer.setSize(originalSize.x, originalSize.y);

    console.log('Exported dome frame:', link.download);
}

// ============================================================================
// GETTERS
// ============================================================================

export function isDomeMode() {
    return DOME_MODE;
}

export function getDomeTargetFPS() {
    return DOME_TARGET_FPS;
}

export function getDomeOutputResolution() {
    return DOME_OUTPUT_RESOLUTION;
}

export function getDomeFrameCount() {
    return domeFrameCount;
}

export function incrementDomeFrameCount() {
    domeFrameCount++;
}

export function resetDomeFrameCount() {
    domeFrameCount = 0;
}

export function getCubeCamera() {
    return cubeCamera;
}

export function getFisheyeScene() {
    return fisheyeScene;
}

export function getFisheyeCamera() {
    return fisheyeCamera;
}

// Make functions available globally for console access
window.exportDomeFrame = exportDomeFrame;
window.renderDomeFrameHighRes = renderDomeFrameHighRes;

