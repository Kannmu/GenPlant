import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls, plantObject, clock, animationFrameId;

const INITIAL_CAMERA_POSITION = new THREE.Vector3(0, 50, 50);
const INITIAL_CAMERA_LOOKAT = new THREE.Vector3(0, 0, 0);

export function init(canvas) {
    // 1. Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xCDF1AA);

    // 2. Camera
    camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.copy(INITIAL_CAMERA_POSITION);
    camera.lookAt(INITIAL_CAMERA_LOOKAT);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.top = 30;
    directionalLight.shadow.camera.bottom = -30;
    directionalLight.shadow.camera.left = -30;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 100;
    scene.add(directionalLight);

    // Ground Plane
    const groundGeometry = new THREE.CylinderGeometry(30, 30, 2, 64);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x99b882 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    // ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // 5. Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.screenSpacePanning = true;
    controls.enablePan = false;
    controls.minDistance = 10;
    controls.maxDistance = 500;
    controls.maxPolarAngle = Math.PI / 2;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 3;

    clock = new THREE.Clock();
    document.addEventListener('visibilitychange', handleVisibilityChange, false);
    // 6. Start rendering loop
    animate();
}

function handleVisibilityChange() {
    if (document.hidden) {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (clock && clock.running) {
            clock.stop();
        }
    } else {
        if (clock) {
            clock.start();
        }
        if (!animationFrameId) {
            animate();
        }
    }
}

export function animate() {
    animationFrameId = requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    controls.update(deltaTime);
    renderer.render(scene, camera);
}

export function add(object) {
    clear();
    plantObject = object;
    if (plantObject) {
        // Center and scale the model to fit the scene
        const box = new THREE.Box3().setFromObject(plantObject);
        const center = box.getCenter(new THREE.Vector3());
        plantObject.position.sub(center);

        const size = box.getSize(new THREE.Vector3());
        const maxSize = Math.max(size.x, size.y, size.z);
        const desiredSize = 75;
        // Avoid division by zero if the model has no size
        if (maxSize > 0) {
            const scale = desiredSize / maxSize;
            plantObject.scale.set(scale, scale, scale);
        }

        plantObject.traverse(function (child) {
            if (child.isMesh) {
                child.castShadow = true;
            }
        });
        scene.add(plantObject);
        controls.target.copy(plantObject.position);
        reset();
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

export function reset() {
    controls.reset();
}

export function loadDefaultModel() {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load('data/defaultModel/glb/defaultModel.glb', function (glb) {
            glb.scene.traverse(function (child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    if (child.material.map) {
                        child.material.map.encoding = THREE.sRGBEncoding;
                    }
                }
            });
            const model = glb.scene;
            resolve(model);
        }, undefined, function (error) {
            console.error("Error in Loading Default Model:", error);
            reject(error);
        });
    });
}



