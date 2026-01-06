/**
 * Scroll Animations Module
 * 
 * Handles wheel-based navigation and step animations for the born experience.
 * Uses WheelAdaptor for discrete scroll events and GSAP for animations.
 */

import gsap from 'gsap';
import { WheelAdaptor } from 'three-story-controls';
import { animate3DText } from './bornTextForDome.js';

// ============================================================================
// ANIMATION STEP DEFINITIONS
// ============================================================================

// Define animation states for each step
const STEPS = [
    //step 0 A strange multiplicity 
    {
        cameraPos: { x: -100, y: 100, z: 50 }, 
        effectParams: { 
            speed: 0.5,
            numBlobs: 10,
            isolation: 50,
            rotation: false,
            rotationSpeed: 0
        }
    },
    //step 1 You come out
    {
        cameraPos: { x: 200, y: 0, z: 100},
        effectParams: { 
            speed: 0.5,
            numBlobs: 10,
            isolation: 50,
            rotation: false,
            rotationSpeed: 0
        }
    },
    //step 2 You grow from blood
    {
        cameraPos: { x: -100, y: 260, z: 500 },
        effectParams: {
            speed: 1,
            numBlobs: 10,
            isolation: 50,
            rotation: false,
            rotationSpeed: 0
        }
    },
    //step 3 They say your blood is 
    {
        cameraPos: { x: 400, y: 200, z: 700 },
        effectParams: {
            speed: 1.0,
            numBlobs: 10,
            isolation: 70,
            rotation: false,
            rotationSpeed: 0
        }
    },
    //step 4 You try to flow into the world
    {
        cameraPos: { x: 100, y: 100, z: 1000 },     
        effectParams: {
            speed: 1,
            numBlobs: 30,
            isolation: 50,
            rotation: false,
            rotationSpeed: 0
        }
    },
    //step 5 You come from a body 
    {
        cameraPos: { x: 300, y: 50, z: 700 }, 
        effectParams: {
            speed: 1,
            numBlobs: 50,
            isolation: 100,
            rotation: false,
            rotationSpeed: 0
        }
    },
    //step 6 You are created from blood under every moon
    {
        cameraPos: { x: 300, y: 50, z: 500}, 
        effectParams: {
            speed: 1.5,
            numBlobs: 40,
            isolation: 5,
            rotation: false,
            rotationSpeed: 0
        }
    },
    //step 7 You are let go
    {
        cameraPos: { x: -100, y: 100, z: 1000 },
        effectParams: {
            speed: 2,
            numBlobs: 30,
            isolation: 5,
            rotation: true,
            rotationSpeed: 0.01
        }
    },
    //step 8 How do people
    {
        cameraPos: { x: 300, y: 100, z: 1500 },
        effectParams: {
            speed: 2,
            numBlobs: 30,
            isolation: 20,
            rotation: true,
            rotationSpeed: .04
        }
    },
    //step 9 You are constantly dying bit by bit
    {
        cameraPos: { x: -150, y: 100, z: 2500 },
        effectParams: {
            speed: 2,
            numBlobs: 30,
            isolation: 50,
            rotation: true,
            rotationSpeed: 0.02
        }
    },
    //step 10 You are the monster they fear
    {
        cameraPos: { x: 200, y: 50, z: 1000},
        effectParams: {
            speed: 1,
            numBlobs: 20,
            isolation: 10,
            rotation: true,
            rotationSpeed: 0.01,
            material: 'webcam'
        }
    },
    //step 11 You are simultaneously 
    {
        cameraPos: { x: 50, y: 0, z: 500},
        effectParams: {
            speed: 1,
            numBlobs: 20,
            isolation: 10,
            rotation: true,
            rotationSpeed: 0.01,
            material: 'webcam'
        }
    },
    //step 12 You are the ultimate 
    {
        cameraPos: { x: 200, y: 50, z: 200},
        effectParams: {
            speed: 1,
            numBlobs: 20,
            isolation: 10,
            rotation: false,
            rotationSpeed: 0,
            material: 'webcam'
        }
    },
    //step 13 There is nothing but warm, sticky blackness
    {
        cameraPos: { x: 200, y: 50, z: -1000},
        effectParams: {
            speed: 1,
            numBlobs: 20,
            isolation: 10,
            rotation: false,
        }
    }
];

// ============================================================================
// STATE
// ============================================================================

let currentStep = 0;
const totalSteps = STEPS.length;

// References to main app objects
let mainCamera = null;
let mainEffect = null;
let mainEffectController = null;
let mainMaterials = null;
let mainEffectGroup = null;
let time = 0;

// Rotation state (exposed for render loop)
let isRotating = false;
let rotationSpeed = 0;

// Current material
let current_material = 'shiny';

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize scroll animations with references to main app objects
 * @param {THREE.Camera} camera - Main camera
 * @param {Object} effect - Marching cubes effect
 * @param {Object} effectController - Effect controller parameters
 * @param {Object} materials - Available materials
 * @param {THREE.Group} effectGroup - Group containing the effect
 */
export function initScrollAnimations(camera, effect, effectController, materials, effectGroup) {
    mainCamera = camera;
    mainEffect = effect;
    mainEffectController = effectController;
    mainMaterials = materials;
    mainEffectGroup = effectGroup;
    
    setupWheelControls();
}

/**
 * Set up wheel-based navigation controls
 */
function setupWheelControls() {
    let wheelAdaptor = new WheelAdaptor({ type: 'discrete' });
    wheelAdaptor.connect();

    // Set up texts array and initial state
    let texts = [];
    for (let i = 0; i < totalSteps; i++) {
        texts.push(document.getElementById(`text${i}`));
    }
    gsap.set(texts, { opacity: 0, scale: 0.8 });
    
    // Show first text after delay
    setTimeout(() => {
        gsap.to(texts[0], {
            opacity: 1,
            scale: 1,
            duration: 1,
            ease: "power2.inOut"
        });
        // Also show 3D text for step 0
        animate3DText(0);
    }, 500);

    // Get buttons for final step
    const buttons = document.querySelectorAll('.outlined-button');
    gsap.set(buttons, { opacity: 0, visibility: 'hidden' });

    // Handle wheel events
    wheelAdaptor.addEventListener('trigger', (e) => {
        if (e.y > 0 && currentStep < totalSteps - 1) { // Forward
            currentStep++;
            animateToStep(currentStep, texts, buttons);
        } else if (e.y < 0 && currentStep > 0) { // Backward
            currentStep--;
            animateToStep(currentStep, texts, buttons);
        }
        console.log('Step:', currentStep);
    });
}

/**
 * Animate to a specific step
 * @param {number} step - Target step number
 * @param {HTMLElement[]} texts - Array of text elements
 * @param {NodeList} buttons - Button elements for final step
 */
function animateToStep(step, texts, buttons) {
    const targetState = STEPS[step];

    // Animate camera position
    gsap.to(mainCamera.position, {
        x: targetState.cameraPos.x,
        y: targetState.cameraPos.y,
        z: targetState.cameraPos.z,
        duration: 2,
        ease: "power2.inOut"
    });

    // Update rotation state
    isRotating = targetState.effectParams.rotation;
    rotationSpeed = targetState.effectParams.rotationSpeed;

    // Update webcam material if specified in the step
    if (targetState.effectParams.material) {
        current_material = targetState.effectParams.material;
        mainEffect.material = mainMaterials[current_material];
        mainEffect.material.needsUpdate = true;
    } else {
        current_material = 'shiny';
    }

    mainEffect.material = mainMaterials[current_material];
    mainEffect.material.needsUpdate = true;

    // Animate effect parameters
    gsap.to(mainEffectController, {
        speed: targetState.effectParams.speed,
        numBlobs: targetState.effectParams.numBlobs,
        isolation: targetState.effectParams.isolation,
        duration: 4,
        ease: "power2.inOut",
        onUpdate: function() {
            mainEffect.isolation = mainEffectController.isolation;
        }
    });

    // Handle text animations (HTML)
    texts.forEach((text, index) => {
        if (!text) return; // skip if text element doesn't exist
        
        gsap.to(text, {
            opacity: index === step ? 1 : 0,
            scale: index === step ? 1 : 0.8,
            duration: 1,
            ease: "power2.inOut"
        });
    });

    // Animate 3D text for dome projection
    animate3DText(step);

    // Hide scroll instruction after step 1 (only if element exists)
    const scrollInstruction = document.querySelector('#scroll-instruction');
    if (scrollInstruction) {
        if (currentStep >= 1) {
            gsap.to('#scroll-instruction', {
                opacity: 0,
                duration: .5
            });
        } else {
            gsap.to('#scroll-instruction', {
                opacity: 1,
                duration: .5
            });
        }
    }

    // Delay the buttons to fade in at last step
    if (currentStep === totalSteps - 1) {
        setTimeout(() => {
            buttons.forEach(button => {
                button.style.visibility = 'visible';
                button.style.cursor = 'pointer';
            });
        
            gsap.to('.outlined-button', {
                opacity: 1,
                duration: 2,
                ease: "power2.inOut",
            });
        }, 1500);
    } else {
        buttons.forEach(button => {
            button.style.visibility = 'hidden';
            button.style.cursor = 'default';
            button.pointerEvents = 'none'; 
        });
    }
}

// ============================================================================
// ROTATION HELPERS (for render loop)
// ============================================================================

/**
 * Apply rotation to effect group if enabled
 */
export function applyRotation() {
    if (isRotating && mainEffectGroup) {
        mainEffectGroup.rotation.y += rotationSpeed;
        mainEffectGroup.rotation.z += rotationSpeed;
    }
}

/**
 * Check if rotation is currently active
 * @returns {boolean}
 */
export function getIsRotating() {
    return isRotating;
}

/**
 * Get current rotation speed
 * @returns {number}
 */
export function getRotationSpeed() {
    return rotationSpeed;
}

/**
 * Get current material name
 * @returns {string}
 */
export function getCurrentMaterial() {
    return current_material;
}

/**
 * Get current step number
 * @returns {number}
 */
export function getCurrentStep() {
    return currentStep;
}

/**
 * Get total number of steps
 * @returns {number}
 */
export function getTotalSteps() {
    return totalSteps;
}

/**
 * Get step definitions (for external modification if needed)
 * @returns {Object[]}
 */
export function getSteps() {
    return STEPS;
}
