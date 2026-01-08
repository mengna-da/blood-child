import * as THREE from 'three';
// console.log("three.js loaded");
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { Linear } from 'gsap'; 
gsap.registerPlugin(ScrollTrigger);
import jQuery from 'jquery';
window.$ = window.jQuery = jQuery; // make jQuery available globally
import { WheelAdaptor } from 'three-story-controls'; 
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Dome projection and recording modules
import { 
    initDomeProjection, 
    isDomeMode, 
    shouldRenderDomeFrame, 
    renderDome, 
    onDomeWindowResize,
    getDomeTargetFPS
} from '../dome/domeProjection.js';
import { initRecording, captureImageSequenceFrame, isImageSequenceMode } from '../dome/recording.js';

// 3D Text for dome projection
import { 
  setup3DText, 
  update3DTextPositions, 
  animate3DTextByPercentage, 
  animate3DTextByStep,
  hideAll3DTexts
} from './unbornTextForDome.js';

// Background sound
window.addEventListener('scroll', () => {
  // console.log("scrolled");
  const audio = document.getElementById('background-audio');
  audio.muted = false;
  audio.play().catch(error => {
    console.error('Audio playback failed:', error);
  });
});

//Mouse movement setup
var Mathutils = {
    normalize: function($value, $min, $max) {
        return ($value - $min) / ($max - $min);
    },
    interpolate: function($normValue, $min, $max) {
        return $min + ($max - $min) * $normValue;
    },
    map: function($value, $min1, $max1, $min2, $max2) {
        if ($value < $min1) {
            $value = $min1;
        }
        if ($value > $max1) {
            $value = $max1;
        }
        var res = this.interpolate(this.normalize($value, $min1, $max1), $min2, $max2);
        return res;
    }
};
var markers = [];


//Get window size
var ww = window.innerWidth,
  wh = window.innerHeight;

var composer, params = {
    exposure: 1.3,
    bloomStrength: .9,
    bloomThreshold: 0, //changed from 0 to 0.1
    bloomRadius: 0
  };

//Create a WebGL renderer
var renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector("canvas"),
  antialias: true,
  shadowMapEnabled: true,
  shadowMapType: THREE.PCFSoftShadowMap
});
renderer.setSize(ww, wh);

//Create an empty scene
var scene = new THREE.Scene();
// scene.background = new THREE.Color(0x000000); 
scene.fog = new THREE.Fog(0x000000,0,500);

var clock = new THREE.Clock();

//Create a perpsective camera
var cameraRotationProxyX = 3.14159;
var cameraRotationProxyY = 0;

var camera = new THREE.PerspectiveCamera(45, ww / wh, 0.1, 200); 
camera.rotation.y = cameraRotationProxyX;
camera.rotation.z = cameraRotationProxyY;

var c = new THREE.Group();
c.position.z = 400;

c.add(camera);
scene.add(c);

//Set up render pass
var renderScene = new RenderPass(scene, camera);
var bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.renderToScreen = true;
bloomPass.threshold = params.bloomThreshold;
bloomPass.strength = params.bloomStrength;
bloomPass.radius = params.bloomRadius;
composer = new EffectComposer(renderer); //composer = new THREE.EffectComposer( renderer );
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// Initialize dome projection and recording modules
// (in dome mode, bloom effect is bypassed for proper fisheye rendering)
initDomeProjection(scene, camera, renderer);
initRecording(renderer, camera, scene);

// Initialize 3D text for dome projection
// This hides HTML text and creates 3D text meshes that deform with fisheye
setup3DText(scene, camera);

//CREATE THE TUBE ===============================================
//array of points
var points = [
	[10, 89, 0],
	[50, 88, 10],
	[76, 139, 20],
	[126, 141, 12],
	[150, 112, 8],
	[157, 73, 0],
	[180, 44, 5],
	[207, 35, 10],
	[232, 36, 0]
];

var p1, p2, p3;

//convert the array of points into vertices
for (var i = 0; i < points.length; i++) {
  var x = points[i][0];
  var y = points[i][2];
  var z = points[i][1];
  points[i] = new THREE.Vector3(x, y, z);
}
//create a path from the points
var path = new THREE.CatmullRomCurve3(points);
//path.curveType = 'catmullrom';
path.tension = .5;

//create a new tube geometry with a different radius
var geometry = new THREE.TubeGeometry( path, 300, 10, 32, false );

//create image texture
var texture = new THREE.TextureLoader().load( '/media/tube-texture-tileable.jpg', function ( texture ){
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.offset.set(0, 0);
    texture.repeat.set(3, 1);
});

var bloodtexture = new THREE.TextureLoader().load( '/media/blood-texture-tileable.jpg', function ( texture ) {
  bloodtexture.wrapS = bloodtexture.wrapT = THREE.RepeatWrapping;
  bloodtexture.offset.set(0, 0);
  bloodtexture.repeat.set(2, 1);
});

//create local video texture
var localVideo = document.getElementById('localVideo');
var localVideoTexture = new THREE.VideoTexture(localVideo);
localVideo.src = '/media/tunnel.mp4';
localVideo.play(); 
// localVideoTexture.wrapS = texture.wrapT = THREE.RepeatWrapping;
// localVideoTexture.repeat.set(3, 1); //for tube texture
localVideoTexture.repeat.set(1.3, 1); //for sphere texture

//create video texture of webcam
// var webcam = document.getElementById('video');
// var webcamTexture = new THREE.VideoTexture(webcam);
// webcamTexture.wrapS = webcamTexture.wrapT = THREE.RepeatWrapping;
// webcamTexture.offset.set(0, 0);
// webcamTexture.repeat.set(3, 15);
// webcamTexture.colorSpace = THREE.SRGBColorSpace;

// // webcam initialization
// if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
//   const constraints = { 
//       video: { 
//           width: 1280, 
//           height: 720, 
//           facingMode: 'user' 
//       } 
//   };

//   navigator.mediaDevices.getUserMedia(constraints)
//       .then(function(stream) {
//           // apply the stream to the video element used in the texture
//           webcam.srcObject = stream;
//           webcam.play();
//       })
//       .catch(function(error) {
//           console.error('Unable to access the camera/webcam.', error);
//       });
// } else {
//   console.error('MediaDevices interface not available.');
// }

//create material for the tube
var material = new THREE.MeshPhongMaterial({
  // color: 0xff0000,
  side:THREE.BackSide,
  map: texture,
  // map:webcamTexture,
  // map: localVideoTexture,
  shininess: 20,
  specular: 0x0b2349
});

//create a mesh
var tube = new THREE.Mesh( geometry, material );
//tube.receiveShadows = true;

//Push the mesh into the scene
scene.add( tube );


//Wireframe / Inner tube =========================================
// //create a new geometry with a different radius
// var geometry = new THREE.TubeGeometry( path, 150, 3.4, 32, false );
// var geo = new THREE.EdgesGeometry( geometry );

// var mat = new THREE.LineBasicMaterial( {
//   linewidth: .1,
//   opacity: .1,
//   transparent: 1
// } );

// var wireframe = new THREE.LineSegments( geo, mat );
// scene.add( wireframe );


//Create lights in our scene =========================================
var light = new THREE.PointLight(0xffffff, .35, 4,0);
light.castShadow = true;
scene.add(light);

const ambientLight = new THREE.AmbientLight(0xffffff, 3); 
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 3); 
directionalLight.position.set(0, 1, 0);
scene.add(directionalLight);

function updateCameraPercentage(percentage) {
  p1 = path.getPointAt(percentage%1);
  p2 = path.getPointAt((percentage + 0.03)%3);
  p3 = path.getPointAt((percentage + 0.05)% 1);

  c.position.set(p1.x,p1.y,p1.z);
  c.lookAt(p2);
  light.position.set(p2.x, p2.y, p2.z);
}


// SCROLL ANIMATIONS =========================================
let cameraTargetPercentage = 0;
let currentCameraPercentage = 0;
gsap.defaultEase = Linear.easeNone;
let tubePerc = {
  percent: 0
}
gsap.registerPlugin(ScrollTrigger);


//Master timeline with gsap scroll trigger
let masterTimeline = gsap.timeline({
  scrollTrigger: {
      trigger: ".scrollTarget",
      start: "top top",
      end: "bottom 100%",
      scrub: 3,
      // markers: {color: "white"}
  }
});

// Scene 1: Tube Travel -------------------------------
// Scene 1 texts
let texts = [
  document.getElementById('text1'),
  document.getElementById('text2'),
  document.getElementById('text3'),
  document.getElementById('text4'),
  document.getElementById('text5'),
  document.getElementById('text6')
];

// Initial state
gsap.set(texts, { opacity: 0, scale: 0.8 });
// tube.material.opacity = 0;
// tube.material.transparent = true;

// Scene 1 timeline
masterTimeline.to(tubePerc, {
    percent: .96,
    ease: Linear.easeNone,
    duration: 500,
    onUpdate: function() {
        cameraTargetPercentage = tubePerc.percent;
        // console.log("Scene 1");
        // console.log("tubePerc.percent: " + tubePerc.percent);

        // update texts based on tube percentage
        texts.forEach((text, index) => {
            // divide the total tube range (0.96) into 5 equal segments
            let segmentSize = 1 / texts.length; // Each segment is ~0.192
            let textStart = index * segmentSize;
            let textEnd = textStart + segmentSize;
            
            // fade out the last text when we reach the end of the tube
            if (index === texts.length - 1 && tubePerc.percent > 0.96) {
              text.style.opacity = 0;
              text.style.transform = 'scale(0.8)';
              return;
            }

            // calculate opacity based on position within segment
            if (tubePerc.percent >= textStart && tubePerc.percent < textEnd) {
                // calculate how far we are into this segment (0 to 1)
                let segmentProgress = (tubePerc.percent - textStart) / segmentSize;
                // console.log(`\nActive Text ${index + 1}:`);
                // console.log(`Progress in segment: ${(segmentProgress * 100).toFixed(1)}%`);
                
                // fade in during first 20% of segment, fade out during last 20%
                let opacity = 1;
                if (segmentProgress < 0.2) {
                    opacity = segmentProgress / 0.2; // Fade in
                } else if (segmentProgress > 0.8) {
                    opacity = 1 - ((segmentProgress - 0.8) / 0.2); // Fade out
                }
                
                text.style.opacity = opacity;
                text.style.transform = `scale(${0.8 + (0.2 * opacity)})`;
            } else {
                text.style.opacity = 0;
                text.style.transform = 'scale(0.8)';
            }
        });
        
        // Update 3D text for dome projection (Scene 1)
        animate3DTextByPercentage(tubePerc.percent);
    }
}, 0);

//Scene 2: Transition to open space --------------------------------
//Create a sphere for Scene 2
const sphereGeometry = new THREE.SphereGeometry(100, 64, 64);
sphereGeometry.rotateY(-Math.PI / 2);
const sphereMaterial = new THREE.MeshBasicMaterial({
  // map: localVideoTexture,
  map: bloodtexture,
  side: THREE.FrontSide,
  transparent: true,
  opacity: 0.8,
  color: 0xC0C0C0 //grey tint
  // color: 0xFFC0C0 //medium red tint
});
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
sphere.position.set(500, -140, 50); //here, x controls how far the sphere is from the tube (e.g. 500 is further than 400), y controls height (e.g. -100 makes it appear higher than -150), z controls left or right (e.g. z=0 makes it appear to the left)

// add animation parameters
const sphereAnimation = {
  rotationSpeed: 0.003
};

scene.add(sphere);

// Scene 2 timeline
let scene2Step = 0;
let totalSteps = 7;

// Create array of camera positions for each Step
const cameraSteps = [
    // Step 0: People call you bleeding monster
    {
        x: 0,
        y: -3,
        z: 100
    },
    // Step 1: You are death, decaying every month every minute
    {
        x: 30,
        y: 3,
        z: 150
    },
    // Step 2: You are life growing every month every minute
    {
        x: 0,
        y: -3,
        z: 200
    },
    // Step 3: Now you're back to where you fall from
    {
        x: -80,
        y: 10,
        z: 80
    },
    // Step 4: You are as immortal as you are alive
    {
      x: -20,
      y: 5,
      z: 30
    },
    // Step 5: There is nothing but warm, sticky blackness
    {
      x: 0,
      y: 10,
      z: -300
    },
    // Step 6: You want to be born
    {
      x: 10,
      y: 10,
      z: -300
    }
];

// Scene 2 texts
let scene2texts = [
  document.getElementById('text7'),
  document.getElementById('text8'),
  document.getElementById('text9'),
  document.getElementById('text10'),
  document.getElementById('text11'),
  document.getElementById('text12'),
  document.getElementById('text13')
];
gsap.set(scene2texts, { opacity: 0, scale: 0.8 })

// hide buttons initially
const buttons = document.querySelectorAll('.outlined-button');
gsap.set(buttons, { opacity: 0 });

// Scene 2 timeline
masterTimeline.to(camera.position, {
  duration: 120,
  ease: "power2.inOut",
  onStart: function() {
      console.log("Scene 2 Start");
      
      // Hide the last text of Scene 1
      gsap.to('#text6', {
          opacity: 0,
          duration: 1
      });

      // Initial camera position reset
      gsap.to(camera.position, {
          x: cameraSteps[0].x,
          y: cameraSteps[0].y,
          z: cameraSteps[0].z,
          duration: 3,
          ease: "power2.inOut",
          onComplete: function() {
            // show the first text of Scene 2 (text7)
            setTimeout(() => {
              scene2texts[0].style.opacity = 1;
              scene2texts[0].style.transform = 'scale(1)';
              scene2texts[0].style.transition = 'all .5s ease-in-out';
              
              // Show 3D text for Scene 2 step 0 (text7)
              animate3DTextByStep(0);
            }, 0);  

              // WheelAdaptor
              let wheelAdaptor = new WheelAdaptor({ type: 'discrete' });
              wheelAdaptor.connect();
              // console.log('Scene 2 WheelAdaptor connected');

              // define the function for wheelAdaptor animations
              function changeCameraAndText ()  {
                gsap.to(camera.position, {
                x: cameraSteps[scene2Step].x,
                y: cameraSteps[scene2Step].y,
                z: cameraSteps[scene2Step].z,
                duration: 2,
                ease: "power2.inOut",
                onStart: function() {
                  // change camera rotation after Step 3
                  if (scene2Step >=3) {
                    cameraTargetPercentage = 1; // stop tube camera movement!
                    gsap.to(camera.rotation, {
                        x: -0.2,
                        y: 0,
                        z: 0,
                        duration: 4,
                        ease: "power2.inOut"
                    });
                }

                // delay the buttons to fade in in last step (step 6 = text13)
                if (scene2Step === 6) {
                  setTimeout(() => {
                    buttons.forEach(button => {
                      button.style.visibility = 'visible';
                    });
                
                    gsap.to('.outlined-button', {
                      opacity: 1,
                      duration: 2,
                      ease: "power2.inOut",
                      onComplete: function() {
                        buttons.forEach(button => {
                          button.style.cursor = 'pointer';
                        });
                      }
                    });
                  }, 1000);
                  } else {
                    buttons.forEach(button => {
                      button.style.visibility = 'hidden';
                      button.style.cursor = 'default';
                    });
                  }

                  // hide all texts
                  scene2texts.forEach((text, index) => {
                      text.style.opacity = 0;
                      text.style.transform = 'scale(0.8)';
                  });
              
                  // show only the current text
                  setTimeout(() => {
                        scene2texts[scene2Step].style.opacity = 1;
                        scene2texts[scene2Step].style.transform = 'scale(1)';
                        
                        // Update 3D text for dome projection (Scene 2)
                        animate3DTextByStep(scene2Step);
                      }, 500);
                  },
                  // onComplete: function() {
                  //   console.log(`Step ${scene2Step} completed`);
                  //   console.log(`New camera position:`, camera.position);
                  // }
                  });
              }

              wheelAdaptor.addEventListener('trigger', (e) => {
                  if (e.y > 0 && scene2Step < totalSteps) { //move forward
                      scene2Step++;
                      changeCameraAndText();
                      // console.log(`\n----- Moving forward to Step ${scene2Step} -----`);
                      // console.log(`Current camera position:`, camera.position);
                  }
                  if (e.y < 0 && scene2Step > 0) { //move backward
                    scene2Step--;
                    changeCameraAndText();
                    // console.log(`\n----- Moving backward to Step ${scene2Step} -----`);
                    // console.log(`Current camera position:`, camera.position);
                }
          });
      }
    });
  }
});

//Scene 2 timeline backup
// masterTimeline.to(camera.position, {
//   z: 200,
//   duration: 5,
//   ease: "power1.inOut",
//   onStart: function() {
//     console.log("Scene 2 Start");

//     // Reset camera position
//     gsap.to(camera.position, {
//       x: 0,
//       y: -3,
//       z: 50,
//       duration: 5,
//       ease: "power1.inOut",
//       onComplete: function() {
//         // controls.enabled = true; // enable orbit controls
//       }
//     });
    
//     // // Reset camera rotation (to see the whole tube)
//     // gsap.to(camera.rotation, {
//     //   x: 0,
//     //   // y: 0,
//     //   y: 3.14, // 180 degrees
//     //   z: 0,
//     //   duration: 5,
//     //   ease: "power1.inOut"
//     // });
    
//     // Stop the camera movement update from the tube
//     cameraTargetPercentage = 1; // stop the tube camera movement
//   },
// });


//Create particles (stars) system =========================================
var ovumTexture = new THREE.TextureLoader().load('/media/ovum.png');
var particleSystem1, particleSystem2, particleSystem3;

// create particle systems
function createParticleSystem() {
    var particleCount = 6800;
    
    // Create geometries
    var particles1 = new THREE.BufferGeometry();
    var particles2 = new THREE.BufferGeometry();
    var particles3 = new THREE.BufferGeometry();
    
    // Create arrays to hold particle positions
    const positions1 = new Float32Array(particleCount * 3);
    const positions2 = new Float32Array(particleCount * 3);
    const positions3 = new Float32Array(particleCount * 3);

    // Fill the arrays with random positions
    for (let i = 0; i < particleCount; i++) {
        // For particles1
        positions1[i * 3] = Math.random() * 500 - 250; // x
        positions1[i * 3 + 1] = Math.random() * 50 - 25; // y
        positions1[i * 3 + 2] = Math.random() * 500 - 250; // z

        // For particles2
        positions2[i * 3] = Math.random() * 500; // x
        positions2[i * 3 + 1] = Math.random() * 10 - 5; // y
        positions2[i * 3 + 2] = Math.random() * 500; // z

        // For particles3
        positions3[i * 3] = Math.random() * 500; // x
        positions3[i * 3 + 1] = Math.random() * 10 - 5; // y
        positions3[i * 3 + 2] = Math.random() * 500; // z
    }

    // Add the positions to the geometries
    particles1.setAttribute('position', new THREE.BufferAttribute(positions1, 3));
    particles2.setAttribute('position', new THREE.BufferAttribute(positions2, 3));
    particles3.setAttribute('position', new THREE.BufferAttribute(positions3, 3));

    var pMaterial = new THREE.PointsMaterial({
        color: 0xFFFFFF,
        size: .5,
        map: ovumTexture,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending
    });

    // Create the particle systems
    particleSystem1 = new THREE.Points(particles1, pMaterial);
    particleSystem2 = new THREE.Points(particles2, pMaterial);
    particleSystem3 = new THREE.Points(particles3, pMaterial);

    // Add them to the scene
    scene.add(particleSystem1);
    scene.add(particleSystem2);
    scene.add(particleSystem3);
}

// Call the function after scene is created and before the render loop
createParticleSystem();

//Render =========================================
function render(){
  // In dome mode, limit to 30fps for consistent output
  if (isDomeMode()) {
    if (!shouldRenderDomeFrame()) {
      requestAnimationFrame(render);
      return;
    }
  }

  if(cameraTargetPercentage < 1) { // Only update during tube section
    currentCameraPercentage = cameraTargetPercentage;
    camera.rotation.y += (cameraRotationProxyX - camera.rotation.y) / 15;
    camera.rotation.x += (cameraRotationProxyY - camera.rotation.x) / 15;
    updateCameraPercentage(currentCameraPercentage);
  }
  
  if (controls.enabled) {
    controls.update(); // Required for damping to work
  }

  // animate sphere
  if (sphere) {
    sphere.rotation.y += sphereAnimation.rotationSpeed;
    sphere.rotation.x += sphereAnimation.rotationSpeed * 0.5;
  }
  
  // animate particles (stars)
  if (particleSystem1) {
      particleSystem1.rotation.y += 0.0002;
      particleSystem2.rotation.x += 0.0005;
      particleSystem3.rotation.z += 0.0001;
  }
  
    // Update 3D text positions to follow camera (for dome projection)
    update3DTextPositions(camera);

  // // debugging sphere position and camera position
  // if (sphere) {
  //     if (Math.random() < 0.01) {
  //         console.log("Sphere visible:", sphere.visible);
  //         console.log("Sphere position:", sphere.position);
  //         console.log("Camera position:", camera.position);
  //         console.log("Camera group position:", c.position);
  //         console.log("Camera forward:", new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion));
  //     }
  // }
  
  // Render the scene
  if (isDomeMode()) {
    // Dome projection rendering (note: bloom effect is bypassed in dome mode)
    renderDome();
    
    // Capture frame for image sequence if recording
    if (isImageSequenceMode()) {
      captureImageSequenceFrame();
    }
  } else {
    // Standard rendering with bloom effect
    composer.render();
  }

  requestAnimationFrame(render);
}
requestAnimationFrame(render);

// $('canvas').click(function(){
//   console.clear();
//   markers.push(p1);
//   console.log(JSON.stringify(markers));
// });
document.querySelector('canvas').addEventListener('click', function() {
  console.clear();
  // markers.push(p1);
  // console.log(JSON.stringify(markers));
});

window.addEventListener( 'resize', function () {
  
  var width = window.innerWidth;
  var height = window.innerHeight;
  
  camera.aspect = width / height;
	camera.updateProjectionMatrix();
  
  renderer.setSize( width, height );
  composer.setSize( width, height );
  
  // Update dome projection camera
  onDomeWindowResize();
  
}, false );

// Mouse movement to control camera rotation ------------------------------
// Disabled for stable dome projection - camera stays centered in tube
// document.addEventListener('mousemove', function(evt) {
//   cameraRotationProxyX = Mathutils.map(evt.clientX, 0, window.innerWidth, 3.24, 3.04);
//   cameraRotationProxyY = Mathutils.map(evt.clientY, 0, window.innerHeight, -.1, .1);
// });

// // Create coordinates helper ---------------------------------
// const axesHelper = new THREE.AxesHelper(500); // size 500
// scene.add(axesHelper);

// // add labels for axes
// const createAxisLabel = (text, position) => {
//     const canvas = document.createElement('canvas');
//     const context = canvas.getContext('2d');
//     canvas.width = 64;
//     canvas.height = 32;
    
//     context.fillStyle = 'white';
//     context.font = '24px Arial';
//     context.fillText(text, 4, 24);
    
//     const texture = new THREE.CanvasTexture(canvas);
//     const material = new THREE.SpriteMaterial({ map: texture });
//     const sprite = new THREE.Sprite(material);
//     sprite.position.copy(position);
//     sprite.scale.set(10, 5, 1);
    
//     return sprite;
// };

// /// create labels
// const xLabel = createAxisLabel('X', new THREE.Vector3(110, 0, 0));
// const yLabel = createAxisLabel('Y', new THREE.Vector3(0, 110, 0));
// const zLabel = createAxisLabel('Z', new THREE.Vector3(0, 0, 110));

// scene.add(xLabel);
// scene.add(yLabel);
// scene.add(zLabel);

// Orbit controls =========================================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Smooth camera movement
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 10;
controls.maxDistance = 500;
controls.maxPolarAngle = Math.PI / 1.5; // Limit vertical rotation

// Enable/disable controls based on scene
controls.enabled = false; // Start with controls disabled during tube scene