import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
// import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import gsap from 'gsap';
// import ScrollTrigger from 'gsap/ScrollTrigger';
import { WheelAdaptor } from 'three-story-controls'; 

let container, stats;

let camera, scene, renderer;

let materials, current_material;

let reflectionCube, refractionCube;

let light, pointLight, ambientLight;

let effect, resolution, effectGroup;

let effectController;

let video, videoTexture;

let time = 0;

const clock = new THREE.Clock();

// Background sound
window.addEventListener('load', () => {
    const audio = document.getElementById('background-audio');
    // console.log("loaded")
    audio.play().catch(error => {
      console.error('Audio playback failed:', error);
    });
  });

// Webcam setup
function setupWebcam() {
    video = document.getElementById('video');
    
    navigator.mediaDevices.getUserMedia({ 
        video: {
            width: 1280,  // Specify video dimensions
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
            videoTexture.repeat.set(1, 2); // 
            
            // Try MeshPhongMaterial for better texture visibility
            materials['webcam'] = new THREE.MeshPhongMaterial({
                map: videoTexture,
                side: THREE.DoubleSide,
                shininess: 10,
                specular: new THREE.Color(0x000000), 
                combine: THREE.MixOperation,
                envMap: reflectionCube,
                reflectivity: 0.3
            });

            // Enable UVs for better texture mapping
            effect.enableUvs = true;
            effect.enableColors = true;

        })
        .catch(function(err) {
            console.log("Webcam error: " + err);
        });
}

// Initial setup
function init() {

    container = document.getElementById( 'container' );

    // CAMERA
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000 );
    // camera.position.set( - 500, 500, 1500 );
    camera.position.set(-100, 100, 50); //initial camera position

    // SCENE
    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x050505 );

    // // AXES (red = X, green = Y, blue = Z)
    // const axesHelper = new THREE.AxesHelper(1000); // Size of the axes (length of each axis)
    // scene.add(axesHelper);

    // LIGHTS
    light = new THREE.DirectionalLight( 0xffffff, 3 );
    light.position.set( 0.5, 0.5, 1 );
    scene.add( light );

    pointLight = new THREE.PointLight( 0xff7c00, 3, 0, 0 );
    pointLight.position.set( 0, 0, 100 );
    scene.add( pointLight );

    ambientLight = new THREE.AmbientLight( 0x323232, 3 );
    scene.add( ambientLight );

    // MATERIALS
    materials = generateMaterials();
    current_material = 'shiny';

    // MARCHING CUBES

    // create a group for the effect
    effectGroup = new THREE.Group();
    scene.add(effectGroup);

    resolution = 80;

    effect = new MarchingCubes( resolution, materials[ current_material ], true, true, 100000 );
    effect.position.set( 200, 0, 0 );
    effect.scale.set( 700, 700, 700 );
    effect.enableUvs = false;
    effect.enableColors = false;

    // scene.add( effect );
    effectGroup.add(effect);

    // RENDERER
    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setAnimationLoop( animate );
    container.appendChild( renderer.domElement );

    // CONTROLS
    setupWheelControls();
    // const controls = new OrbitControls( camera, renderer.domElement );
    // controls.minDistance = 100;
    // controls.maxDistance = 5000;

    // STATS
    // stats = new Stats();
    // container.appendChild( stats.dom );

    // GUI
    // setupGui();

    // EVENTS
    window.addEventListener( 'resize', onWindowResize );

    // WEB CAM
    setupWebcam();

    // const audio = document.getElementById('background-audio');
    // audio.play().catch(error => {
    //   console.error('Audio playback failed:', error);
    // });
}

init();

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}

function generateMaterials() {

    // environment map -------------

    const path = '/textures/BloodEnvironment/';
    const format = '.png';
    const urls = [
        path + 'px' + format, path + 'nx' + format,
        path + 'py' + format, path + 'ny' + format,
        path + 'pz' + format, path + 'nz' + format
    ];

    const cubeTextureLoader = new THREE.CubeTextureLoader();

    reflectionCube = cubeTextureLoader.load( urls );
    refractionCube = cubeTextureLoader.load( urls );
    refractionCube.mapping = THREE.CubeRefractionMapping;

    const materials = {
            'shiny': new THREE.MeshStandardMaterial( { color: 0x9c0000, envMap: reflectionCube, roughness: 0.1, metalness: 1 } ),
            'chrome': new THREE.MeshLambertMaterial( { color: 0xffffff, envMap: reflectionCube } ),
            'liquid': new THREE.MeshLambertMaterial( { color: 0xffffff, envMap: refractionCube, refractionRatio: 0.85} )
    };

    return materials;

}

function createShaderMaterial( shader, light, ambientLight ) {

    const u = THREE.UniformsUtils.clone( shader.uniforms );

    const vs = shader.vertexShader;
    const fs = shader.fragmentShader;

    const material = new THREE.ShaderMaterial( { uniforms: u, vertexShader: vs, fragmentShader: fs } );

    material.uniforms[ 'uDirLightPos' ].value = light.position;
    material.uniforms[ 'uDirLightColor' ].value = light.color;

    material.uniforms[ 'uAmbientLightColor' ].value = ambientLight.color;

    return material;

}

// GUI ================================================================
// function setupGui() {

//     const createHandler = function ( id ) {

//         return function () {

//             current_material = id;

//             effect.material = materials[ id ];
//             effect.enableUvs = ( current_material === 'textured' ) ? true : false;
//             effect.enableColors = ( current_material === 'colors' || current_material === 'multiColors' ) ? true : false;

//         };

//     };

//     effectController = {

//         material: 'shiny',

//         speed: .5,
//         numBlobs: 10,
//         resolution: 80,
//         isolation: 50,

//         floor: false,
//         wallx: false,
//         wallz: false,

//         dummy: function () {}

//     };

//     let h;

//     const gui = new GUI();

//     // material (type)

//     h = gui.addFolder( 'Materials' );

//     for ( const m in materials ) {

//         effectController[ m ] = createHandler( m );
//         h.add( effectController, m ).name( m );

//     }

//     // simulation

//     h = gui.addFolder( 'Simulation' );

//     h.add( effectController, 'speed', 0.1, 8.0, 0.05 );
//     h.add( effectController, 'numBlobs', 1, 50, 1 );
//     h.add( effectController, 'resolution', 14, 100, 1 );
//     h.add( effectController, 'isolation', 10, 300, 1 );
    
//     h.add( effectController, 'floor' );
//     h.add( effectController, 'wallx' );
//     h.add( effectController, 'wallz' );

// }

effectController = {

    material: 'shiny',

    speed: .5,
    numBlobs: 10,
    resolution: 80,
    isolation: 50,

    floor: false,
    wallx: false,
    wallz: false,

    dummy: function () {}

};

// SWIPE SCROLL ANIMATIONS =================================================
function setupWheelControls() {
    let wheelAdaptor = new WheelAdaptor({ type: 'discrete' });
    wheelAdaptor.connect();
    
    let currentStep = 0;
    const totalSteps = 13; // 13 texts, starting from text0 to text12

    // set up texts array and initial state (14 texts, starting with text0)
    let texts = [];
    for (let i = 0; i <= totalSteps; i++) {
        texts.push(document.getElementById(`text${i}`));
    }
    gsap.set(texts, { opacity: 0, scale: 0.8 });
    
    setTimeout(() => {
        gsap.to(texts[0], {
            opacity: 1,
            scale: 1,
            duration: 1,
            ease: "power2.inOut"
        });
    }, 500); 

    // Define animation states for each step
    const steps = [
        //step 0
        {
            cameraPos: { x: -100, y: 100, z: 30 }, 
            effectParams: { 
                speed: 0.5,
                numBlobs: 10,
                isolation: 50,
                rotation: false,
                rotationSpeed: 0
            }
        },
        //step 1
        {
            cameraPos: { x: 200, y: 0, z: 100}, //{ x: -182, y: 182, z: 400 }
            effectParams: { 
                speed: 1,
                numBlobs: 10,
                isolation: 50,
                rotation: false,
                rotationSpeed: 0
            }
        },
        //step 2
        {
            cameraPos: { x: -100, y: 260, z: 500 }, //{ x: 260, y: 260, z: 785 }
            effectParams: {
                speed: 1,
                numBlobs: 10,
                isolation: 50,
                rotation: false,
                rotationSpeed: 0
            }
        },
        //step 3
        {
            cameraPos: { x: 400, y: 200, z: 1000 },
            effectParams: {
                speed: 1.0,
                numBlobs: 10,
                isolation: 70,
                rotation: false,
                rotationSpeed: 0
            }
        },
        //step 4
        {
            cameraPos: { x: 100, y: 100, z: 1800 }, //z: 1500
            effectParams: {
                speed: 1,
                numBlobs: 30,
                isolation: 50,
                rotation: false,
                rotationSpeed: 0
            }
        },
        //step 5
        {
            cameraPos: { x: 300, y: 50, z: 700 }, //z: 1500
            effectParams: {
                speed: 1,
                numBlobs: 50,
                isolation: 100,
                rotation: false,
                rotationSpeed: 0
            }
        },
        //step 6
        {
            cameraPos: { x: 200, y: 50, z: 1000}, 
            effectParams: {
                speed: 1.5,
                numBlobs: 40,
                isolation: 5,
                rotation: false,
                rotationSpeed: 0
            }
        },
        //step 7
        {
            cameraPos: { x: -100, y: 100, z: 1500 },
            effectParams: {
                speed: 2,
                numBlobs: 30,
                isolation: 5,
                rotation: true,
                rotationSpeed: 0.01
            }
        },
        //step 8
        {
            cameraPos: { x: 300, y: 100, z: 2500 },
            effectParams: {
                speed: 2,
                numBlobs: 30,
                isolation: 20,
                rotation: true,
                rotationSpeed: .04
            }
        },
        //step 9
        {
            cameraPos: { x: -150, y: 100, z: 3500 },
            effectParams: {
                speed: 2,
                numBlobs: 30,
                isolation: 50,
                rotation: true,
                rotationSpeed: 0.02
            }
        },
        //step 10
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
        //step 11
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
        //step 12
        {
            cameraPos: { x: 200, y: 50, z: -1000},
            effectParams: {
                speed: 1,
                numBlobs: 20,
                isolation: 10,
                rotation: false,
                rotationSpeed: 0,
                material: 'webcam'
            }
        }
    ];

    const buttons = document.querySelectorAll('.outlined-button');
    gsap.set(buttons, { opacity: 0, visibility: 'hidden' });

    wheelAdaptor.addEventListener('trigger', (e) => {
        if (e.y > 0 && currentStep < totalSteps - 1) { // Forward
            currentStep++;
            animateToStep(currentStep);
        } else if (e.y < 0 && currentStep > 0) { // Backward
            currentStep--;
            animateToStep(currentStep);
        }
        console.log(currentStep);
    });

    function animateToStep(step) {
        const targetState = steps[step];

        // animate camera position
        gsap.to(camera.position, {
            x: targetState.cameraPos.x,
            y: targetState.cameraPos.y,
            z: targetState.cameraPos.z,
            duration: 2,
            ease: "power2.inOut"
        });

        // animate rotation
        isRotating = targetState.effectParams.rotation;
        rotationSpeed = targetState.effectParams.rotationSpeed;

        // update webcam material if specified in the step
        if (targetState.effectParams.material) {
            current_material = targetState.effectParams.material;
            effect.material = materials[current_material];
            effect.material.needsUpdate = true;
        } else {
                current_material = 'shiny';
        }

        effect.material = materials[current_material];
        effect.material.needsUpdate = true;

        // animate effect parameters
        gsap.to(effectController, {
            speed: targetState.effectParams.speed,
            numBlobs: targetState.effectParams.numBlobs,
            isolation: targetState.effectParams.isolation,
            duration: 4,
            ease: "power2.inOut",
            onUpdate: function() {
                effect.isolation = effectController.isolation;
                updateCubes(effect, time, effectController.numBlobs, 
                    effectController.floor, effectController.wallx, effectController.wallz);
            }
        });

        // handle text animations
        texts.forEach((text, index) => {
            if (!text) return; // skip if text element doesn't exist
            
            gsap.to(text, {
                opacity: index === step ? 1 : 0,
                scale: index === step ? 1 : 0.8,
                duration: 1,
                ease: "power2.inOut"
            });
        });

        // hide scroll instruction after step 1
        if (currentStep >= 1){
            gsap.to('#scroll-instruction', {
                opacity: 0,
                duration: .5
            })
        } else {
            gsap.to('#scroll-instruction', {
                opacity: 1,
                duration: .5
            })
        }

        // delay the buttons to fade in in last step
        if (currentStep === 12) {
            setTimeout(() => {
              buttons.forEach(button => {
                button.style.visibility = 'visible';
                button.style.cursor = 'pointer';
              });
          
              gsap.to('.outlined-button', {
                opacity: 1,
                duration: 2,
                ease: "power2.inOut",
                // onComplete: function() {
                //   buttons.forEach(button => {
                //     button.style.cursor = 'pointer';
                //   });
                // }
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
}


// BLOBS ================================================================
// this controls content of marching cubes voxel field
function updateCubes( object, time, numblobs, floor, wallx, wallz ) {

    object.reset();

    // fill the field with some metaballs

    const rainbow = [
        new THREE.Color( 0xff0000 ),
        new THREE.Color( 0xffbb00 ),
        new THREE.Color( 0xffff00 ),
        new THREE.Color( 0x00ff00 ),
        new THREE.Color( 0x0000ff ),
        new THREE.Color( 0x9400bd ),
        new THREE.Color( 0xc800eb )
    ];
    const subtract = 12; // size of each blob
    const strength = 1.2 / ( ( Math.sqrt( numblobs ) - 1 ) / 4 + 1 );

    for ( let i = 0; i < numblobs; i ++ ) {

        const ballx = Math.sin( i + 1.26 * time * ( 1.03 + 0.5 * Math.cos( 0.21 * i ) ) ) * 0.27 + 0.5;
        const bally = Math.abs( Math.cos( i + 1.12 * time * Math.cos( 1.22 + 0.1424 * i ) ) ) * 0.77; // dip into the floor
        const ballz = Math.cos( i + 1.32 * time * 0.1 * Math.sin( ( 0.92 + 0.53 * i ) ) ) * 0.27 + 0.5;

        if ( current_material === 'multiColors' ) {

            object.addBall( ballx, bally, ballz, strength, subtract, rainbow[ i % 7 ] );

        } else {

            object.addBall( ballx, bally, ballz, strength, subtract );

        }

    }

    if ( floor ) object.addPlaneY( 2, 12 );
    if ( wallz ) object.addPlaneZ( 2, 12);
    if ( wallx ) object.addPlaneX( 2, 12 );

    object.update();

}

//

function animate() {

    render();
    // stats.update();

}

// rotation of the blobs group
let isRotating = false;
let rotationSpeed = 0;

function render() {

    const delta = clock.getDelta();

    time += delta * effectController.speed * 0.5;

    // console.log('Camera:', {
    //     // position: {
    //         x: camera.position.x.toFixed(2),
    //         y: camera.position.y.toFixed(2),
    //         z: camera.position.z.toFixed(2),
    //     // },
    //     // rotation: {
    //         // xr: THREE.MathUtils.radToDeg(camera.rotation.x).toFixed(2),
    //         // yr: THREE.MathUtils.radToDeg(camera.rotation.y).toFixed(2),
    //         // zr: THREE.MathUtils.radToDeg(camera.rotation.z).toFixed(2)
    //     // }
    // });

    // marching cubes

    if ( effectController.resolution !== resolution ) {

        resolution = effectController.resolution;
        effect.init( Math.floor( resolution ) );

    }

    if ( effectController.isolation !== effect.isolation ) {

        effect.isolation = effectController.isolation;

    }

    updateCubes( effect, time, effectController.numBlobs, effectController.floor, effectController.wallx, effectController.wallz );

    // rotation
    if (isRotating) {
        effectGroup.rotation.y += rotationSpeed;
        effectGroup.rotation.z += rotationSpeed;
    }

    // update video texture if there is one
    if (current_material === 'webcam' && videoTexture) {
        videoTexture.needsUpdate = true;
    }

    // render

    renderer.render( scene, camera );

}