/**
 * Born - Main Entry Point
 * 
 * This is the main file for the "born" experience.
 * 
 * Modular structure:
 *   - bornDomeProjection.js  - Dome projection mode, fisheye camera, shader
 *   - bornRecording.js       - Video recording and image sequence export
 *   - bornScrollAnimations.js - Wheel controls and step animations
 *   - bornTextForDome.js     - 3D text for dome projection
 */

import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

// Modular imports
import { setup3DText, update3DTextPositions } from './bornTextForDome.js';
import { 
    initDomeProjection, 
    isDomeMode, 
    shouldRenderDomeFrame, 
    renderDome, 
    onDomeWindowResize,
    getDomeTargetFPS
} from './bornDomeProjection.js';
import { initRecording, captureImageSequenceFrame, isImageSequenceMode } from './bornRecording.js';
import { initScrollAnimations, applyRotation, getCurrentMaterial } from './bornScrollAnimations.js';

// ============================================================================
// CORE VARIABLES
// ============================================================================

let container;
let camera, scene, renderer;
let materials, current_material;
let reflectionCube, refractionCube;
let light, pointLight, ambientLight;
let effect, resolution, effectGroup;
let effectController;
let video, videoTexture;
let time = 0;
const clock = new THREE.Clock();

// ============================================================================
// AUDIO
// ============================================================================

// Background sound - requires user interaction due to browser autoplay policy
let audioStarted = false;

function startAudio() {
    if (audioStarted) return;
    const audio = document.getElementById('background-audio');
    if (audio) {
        audio.play().then(() => {
            audioStarted = true;
            console.log('Audio started');
        }).catch(error => {
            console.error('Audio playback failed:', error);
        });
    }
}

// Try to start audio on any user interaction
['click', 'touchstart', 'keydown', 'wheel', 'scroll'].forEach(event => {
    document.addEventListener(event, startAudio, { once: false });
});

// Also try on load in case autoplay is allowed
window.addEventListener('load', () => {
    const audio = document.getElementById('background-audio');
    if (audio) {
        audio.play().then(() => {
            audioStarted = true;
        }).catch(() => {
            console.log('Audio waiting for user interaction...');
        });
    }
});

// ============================================================================
// WEBCAM
// ============================================================================

function setupWebcam() {
    video = document.getElementById('video');
    
    navigator.mediaDevices.getUserMedia({ 
        video: {
            width: 1280,
            height: 720
        }})
        .then(function(stream) {
            video.srcObject = stream;
            video.play();

            videoTexture = new THREE.VideoTexture(video);
            videoTexture.minFilter = THREE.LinearFilter;
            videoTexture.magFilter = THREE.LinearFilter;
            videoTexture.wrapS = THREE.RepeatWrapping;
            videoTexture.wrapT = THREE.RepeatWrapping;
            videoTexture.repeat.set(1, 2);
            
            materials['webcam'] = new THREE.MeshPhongMaterial({
                map: videoTexture,
                side: THREE.DoubleSide,
                shininess: 10,
                specular: new THREE.Color(0x000000), 
                combine: THREE.MixOperation,
                envMap: reflectionCube,
                reflectivity: 0.3
            });

            effect.enableUvs = true;
            effect.enableColors = true;
        })
        .catch(function(err) {
            console.log("Webcam error: " + err);
        });
}

// ============================================================================
// MATERIALS
// ============================================================================

function generateMaterials() {
    const path = '/textures/BloodEnvironment/';
    const format = '.png';
    const urls = [
        path + 'px' + format, path + 'nx' + format,
        path + 'py' + format, path + 'ny' + format,
        path + 'pz' + format, path + 'nz' + format
    ];

    const cubeTextureLoader = new THREE.CubeTextureLoader();

    reflectionCube = cubeTextureLoader.load(urls);
    refractionCube = cubeTextureLoader.load(urls);
    refractionCube.mapping = THREE.CubeRefractionMapping;

    const materials = {
        'shiny': new THREE.MeshStandardMaterial({ 
            color: 0x9c0000, 
            envMap: reflectionCube, 
            roughness: 0.1, 
            metalness: 1, 
            side: THREE.DoubleSide 
        }),
        'chrome': new THREE.MeshLambertMaterial({ 
            color: 0xffffff, 
            envMap: reflectionCube, 
            side: THREE.DoubleSide 
        }),
        'liquid': new THREE.MeshLambertMaterial({ 
            color: 0xffffff, 
            envMap: refractionCube, 
            refractionRatio: 0.85, 
            side: THREE.DoubleSide 
        })
    };

    return materials;
}

// ============================================================================
// EFFECT CONTROLLER
// ============================================================================

effectController = {
    material: 'shiny',
    speed: .5,
    numBlobs: 10,
    resolution: 80,
    isolation: 50,
    floor: false,
    wallx: false,
    wallz: false,
    dummy: function() {}
};

// ============================================================================
// MARCHING CUBES (BLOBS)
// ============================================================================

function updateCubes(object, time, numblobs, floor, wallx, wallz) {
    object.reset();

    const rainbow = [
        new THREE.Color(0xff0000),
        new THREE.Color(0xffbb00),
        new THREE.Color(0xffff00),
        new THREE.Color(0x00ff00),
        new THREE.Color(0x0000ff),
        new THREE.Color(0x9400bd),
        new THREE.Color(0xc800eb)
    ];
    
    const subtract = 12;
    const strength = 1.2 / ((Math.sqrt(numblobs) - 1) / 4 + 1);

    for (let i = 0; i < numblobs; i++) {
        const ballx = Math.sin(i + 1.26 * time * (1.03 + 0.5 * Math.cos(0.21 * i))) * 0.27 + 0.5;
        const bally = Math.abs(Math.cos(i + 1.12 * time * Math.cos(1.22 + 0.1424 * i))) * 0.77;
        const ballz = Math.cos(i + 1.32 * time * 0.1 * Math.sin((0.92 + 0.53 * i))) * 0.27 + 0.5;

        if (getCurrentMaterial() === 'multiColors') {
            object.addBall(ballx, bally, ballz, strength, subtract, rainbow[i % 7]);
        } else {
            object.addBall(ballx, bally, ballz, strength, subtract);
        }
    }

    if (floor) object.addPlaneY(2, 12);
    if (wallz) object.addPlaneZ(2, 12);
    if (wallx) object.addPlaneX(2, 12);

    object.update();
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
    container = document.getElementById('container');

    // CAMERA
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(-100, 100, 50);

    // SCENE
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);

    // LIGHTS
    light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(0.5, 0.5, 1);
    scene.add(light);

    pointLight = new THREE.PointLight(0xff7c00, 3, 0, 0);
    pointLight.position.set(0, 0, 100);
    scene.add(pointLight);

    ambientLight = new THREE.AmbientLight(0x323232, 3);
    scene.add(ambientLight);

    // MATERIALS
    materials = generateMaterials();
    current_material = 'shiny';

    // MARCHING CUBES
    effectGroup = new THREE.Group();
    scene.add(effectGroup);

    resolution = 80;

    effect = new MarchingCubes(resolution, materials[current_material], true, true, 100000);
    effect.position.set(200, 0, 0);
    effect.scale.set(700, 700, 700);
    effect.enableUvs = false;
    effect.enableColors = false;

    effectGroup.add(effect);

    // RENDERER
    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    container.appendChild(renderer.domElement);

    // INITIALIZE MODULES
    initDomeProjection(scene, camera, renderer);
    initRecording(renderer, camera, scene);
    initScrollAnimations(camera, effect, effectController, materials, effectGroup);
    
    // 3D TEXT SETUP (for dome projection)
    setup3DText(scene, camera);

    // EVENTS
    window.addEventListener('resize', onWindowResize);

    // WEBCAM
    setupWebcam();
}

// ============================================================================
// WINDOW RESIZE
// ============================================================================

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Update dome projection camera
    onDomeWindowResize();
}

// ============================================================================
// ANIMATION LOOP
// ============================================================================

function animate() {
    // In dome mode, limit to 30fps for consistent output
    if (isDomeMode()) {
        if (!shouldRenderDomeFrame()) {
            return;
        }
    }

    render();
}

// ============================================================================
// RENDER
// ============================================================================

function render() {
    // Use fixed delta for dome mode to ensure consistent animation speed at 30fps
    let delta;
    if (isDomeMode()) {
        delta = 1 / getDomeTargetFPS();
    } else {
        delta = clock.getDelta();
    }

    time += delta * effectController.speed * 0.5;

    // Marching cubes resolution update
    if (effectController.resolution !== resolution) {
        resolution = effectController.resolution;
        effect.init(Math.floor(resolution));
    }

    if (effectController.isolation !== effect.isolation) {
        effect.isolation = effectController.isolation;
    }

    updateCubes(effect, time, effectController.numBlobs, effectController.floor, effectController.wallx, effectController.wallz);

    // Apply rotation from scroll animations module
    applyRotation();

    // Update video texture if using webcam
    if (getCurrentMaterial() === 'webcam' && videoTexture) {
        videoTexture.needsUpdate = true;
    }

    // Update 3D text positions to follow camera (for dome projection)
    update3DTextPositions(camera);

    // Render
    if (isDomeMode()) {
        // Dome projection rendering
        renderDome();
        
        // Capture frame for image sequence if recording
        if (isImageSequenceMode()) {
            captureImageSequenceFrame();
        }
    } else {
        // Standard rendering
        renderer.render(scene, camera);
    }
}

// ============================================================================
// START
// ============================================================================

init();
