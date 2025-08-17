import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls, plantObject;

export function init(canvas) {
    // 1. Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xCDF1AA);

    // 2. Camera
    camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.set(0, 20, 50);
    camera.lookAt(0, 0, 0);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    scene.add(directionalLight);

    // 5. Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 10;
    controls.maxDistance = 500;
    controls.maxPolarAngle = Math.PI / 2;
    // 6. Start rendering loop
    animate();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

export function add(object) {
    plantObject = object;
    if (plantObject) {
        scene.add(plantObject);
    }
}

export function clear() {
    if (plantObject) {
        scene.remove(plantObject);
        // Dispose of geometry and material to free up memory
        if (plantObject.geometry) {
            plantObject.geometry.dispose();
        }
        if (plantObject.material) {
            if (Array.isArray(plantObject.material)) {
                plantObject.material.forEach(m => m.dispose());
            } else {
                plantObject.material.dispose();
            }
        }
    }
    plantObject = null;
}


export function loadDefaultModel() {
    const loader = new GLTFLoader();
    loader.load('../Data/DefaultModel/defaultModel.gltf', function (gltf) {
        scene.add(gltf.scene);
    }, undefined, function (error) {
        console.error(error);
    });
}



