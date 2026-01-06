/**
 * Recording Module
 * 
 * Handles video recording and image sequence export for dome projection.
 * 
 * Keyboard Controls:
 *   R - Start/Stop video recording
 *   I - Export single high-res frame
 *   S - Start/Stop image sequence capture
 */

import * as THREE from 'three';
import { 
    isDomeMode, 
    getDomeTargetFPS, 
    getDomeOutputResolution,
    getDomeFrameCount,
    resetDomeFrameCount,
    getCubeCamera,
    getFisheyeScene,
    getFisheyeCamera
} from './bornDomeProjection.js';

// ============================================================================
// RECORDING SETTINGS
// ============================================================================

// Recording resolution (use smaller for preview, larger for final)
const RECORDING_RESOLUTION = 2048; // 2048x2048 for manageable file size, 4096 for full quality

// Video recording state
let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];
let recordingStream = null;

// Image sequence state
let imageSequenceMode = false;
let imageSequenceFrames = [];
let imageSequenceFrameCount = 0;

// References to main app objects
let mainRenderer = null;
let mainCamera = null;
let mainScene = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize recording module with references to main app objects
 * @param {THREE.WebGLRenderer} renderer - Main renderer
 * @param {THREE.Camera} camera - Main camera
 * @param {THREE.Scene} scene - Main scene
 */
export function initRecording(renderer, camera, scene) {
    mainRenderer = renderer;
    mainCamera = camera;
    mainScene = scene;
    
    // Set up keyboard controls
    setupRecordingKeyboardControls();
}

/**
 * Set up keyboard controls for recording
 */
function setupRecordingKeyboardControls() {
    window.addEventListener('keydown', (e) => {
        // Press 'R' to start/stop video recording
        if (e.key === 'r' || e.key === 'R') {
            if (isDomeMode()) {
                toggleRecording();
            } else {
                console.log('Enable dome mode first (press D) before recording');
            }
        }
        
        // Press 'I' to export single frame as image
        if (e.key === 'i' || e.key === 'I') {
            if (isDomeMode()) {
                exportSingleFrame();
            } else {
                console.log('Enable dome mode first (press D)');
            }
        }
        
        // Press 'S' to start/stop image sequence recording
        if (e.key === 's' || e.key === 'S') {
            if (isDomeMode()) {
                toggleImageSequence();
            } else {
                console.log('Enable dome mode first (press D)');
            }
        }
    });
}

// ============================================================================
// VIDEO RECORDING
// ============================================================================

/**
 * Toggle video recording on/off
 */
export function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

/**
 * Start recording video from the canvas
 */
export function startRecording() {
    if (isRecording) return;
    
    const DOME_TARGET_FPS = getDomeTargetFPS();
    
    // Set canvas to recording resolution
    mainRenderer.setSize(RECORDING_RESOLUTION, RECORDING_RESOLUTION);
    
    // Get stream from canvas
    const canvas = mainRenderer.domElement;
    recordingStream = canvas.captureStream(DOME_TARGET_FPS);
    
    // Set up MediaRecorder
    const options = { 
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 50000000 // 50 Mbps for high quality
    };
    
    try {
        mediaRecorder = new MediaRecorder(recordingStream, options);
    } catch (e) {
        // Fallback to default codec
        console.warn('VP9 not supported, using default codec');
        mediaRecorder = new MediaRecorder(recordingStream);
    }
    
    recordedChunks = [];
    
    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };
    
    mediaRecorder.onstop = () => {
        // Create video blob and download
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dome_recording_${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log('Recording saved!');
        
        // Restore original size
        mainRenderer.setSize(window.innerWidth, window.innerHeight);
    };
    
    mediaRecorder.start();
    isRecording = true;
    resetDomeFrameCount();
    
    console.log('='.repeat(50));
    console.log('🔴 RECORDING STARTED');
    console.log('Resolution:', RECORDING_RESOLUTION + 'x' + RECORDING_RESOLUTION);
    console.log('FPS:', DOME_TARGET_FPS);
    console.log('Press R again to stop and save');
    console.log('='.repeat(50));
}

/**
 * Stop recording and save the video
 */
export function stopRecording() {
    if (!isRecording || !mediaRecorder) return;
    
    mediaRecorder.stop();
    isRecording = false;
    
    console.log('='.repeat(50));
    console.log('⬛ RECORDING STOPPED');
    console.log('Frames recorded:', getDomeFrameCount());
    console.log('Saving video...');
    console.log('='.repeat(50));
}

// ============================================================================
// SINGLE FRAME EXPORT
// ============================================================================

/**
 * Export a single high-resolution frame
 */
export function exportSingleFrame() {
    const cubeCamera = getCubeCamera();
    const fisheyeScene = getFisheyeScene();
    const fisheyeCamera = getFisheyeCamera();
    const DOME_OUTPUT_RESOLUTION = getDomeOutputResolution();
    
    if (!cubeCamera) {
        console.error('Dome mode not initialized');
        return;
    }
    
    // Store original size
    const originalWidth = mainRenderer.domElement.width;
    const originalHeight = mainRenderer.domElement.height;
    
    // Set to high resolution
    mainRenderer.setSize(DOME_OUTPUT_RESOLUTION, DOME_OUTPUT_RESOLUTION);
    
    // Render one frame
    cubeCamera.position.copy(mainCamera.position);
    cubeCamera.update(mainRenderer, mainScene);
    mainRenderer.render(fisheyeScene, fisheyeCamera);
    
    // Export as PNG
    const dataURL = mainRenderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `dome_frame_${DOME_OUTPUT_RESOLUTION}x${DOME_OUTPUT_RESOLUTION}_${Date.now()}.png`;
    link.href = dataURL;
    link.click();
    
    // Restore original size
    mainRenderer.setSize(originalWidth, originalHeight);
    
    console.log('Exported frame at', DOME_OUTPUT_RESOLUTION + 'x' + DOME_OUTPUT_RESOLUTION);
}

// ============================================================================
// IMAGE SEQUENCE
// ============================================================================

/**
 * Toggle image sequence recording
 */
export function toggleImageSequence() {
    if (imageSequenceMode) {
        stopImageSequence();
    } else {
        startImageSequence();
    }
}

/**
 * Start capturing image sequence
 */
export function startImageSequence() {
    imageSequenceMode = true;
    imageSequenceFrames = [];
    imageSequenceFrameCount = 0;
    
    // Set to recording resolution
    mainRenderer.setSize(RECORDING_RESOLUTION, RECORDING_RESOLUTION);
    
    console.log('='.repeat(50));
    console.log('📷 IMAGE SEQUENCE STARTED');
    console.log('Resolution:', RECORDING_RESOLUTION + 'x' + RECORDING_RESOLUTION);
    console.log('Press S again to stop and download frames');
    console.log('='.repeat(50));
}

/**
 * Stop image sequence and download frames
 */
export function stopImageSequence() {
    imageSequenceMode = false;
    
    console.log('='.repeat(50));
    console.log('📷 IMAGE SEQUENCE STOPPED');
    console.log('Frames captured:', imageSequenceFrameCount);
    console.log('Downloading frames...');
    console.log('='.repeat(50));
    
    // Download each frame (browsers may block multiple downloads)
    // For production, you'd want to use JSZip to bundle them
    imageSequenceFrames.forEach((dataURL, index) => {
        setTimeout(() => {
            const link = document.createElement('a');
            link.download = `frame_${String(index).padStart(6, '0')}.png`;
            link.href = dataURL;
            link.click();
        }, index * 100); // Stagger downloads to avoid blocking
    });
    
    // Clear frames array
    imageSequenceFrames = [];
    
    // Restore original size
    mainRenderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Capture current frame for image sequence (called from render loop)
 */
export function captureImageSequenceFrame() {
    if (!imageSequenceMode) return;
    
    const dataURL = mainRenderer.domElement.toDataURL('image/png');
    imageSequenceFrames.push(dataURL);
    imageSequenceFrameCount++;
    
    // Log every 30 frames
    if (imageSequenceFrameCount % 30 === 0) {
        console.log('Captured frame:', imageSequenceFrameCount);
    }
}

// ============================================================================
// GETTERS
// ============================================================================

export function isCurrentlyRecording() {
    return isRecording;
}

export function isImageSequenceMode() {
    return imageSequenceMode;
}

// Make recording functions available globally for console access
window.startRecording = startRecording;
window.stopRecording = stopRecording;
window.exportSingleFrame = exportSingleFrame;
window.toggleRecording = toggleRecording;

