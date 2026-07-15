import * as THREE from "three";
import { RENDERER_CONFIG } from '../config/constants.js';
import { createLights } from './Lights.js';
import { createGround } from './Ground.js';

/**
 * 场景图所有权：场景、雾、灯光、地面，以及 plant/preview 的统一 add/remove/dispose。
 * 唯一的「植物入/出场景」入口，保证 dispose 不漏不复。
 */
export function createSceneManager() {
    const { SCENE } = RENDERER_CONFIG;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE.FOG_COLOR);
    scene.fog = new THREE.Fog(SCENE.FOG_COLOR, SCENE.FOG_NEAR, SCENE.FOG_FAR);

    const lights = createLights(scene);
    const { group: groundGroup, surface, dais } = createGround();
    scene.add(groundGroup);

    const gardenRoot = new THREE.Group();
    gardenRoot.name = 'garden-root';
    const creatorRoot = new THREE.Group();
    creatorRoot.name = 'creator-root';
    scene.add(gardenRoot, creatorRoot);

    // 预览植物（造物模式），与花园植物分离管理
    let previewObject = null;

    // plant registry: id -> { object } 便于集中 dispose 与查找
    const plants = new Map();
    let elapsed = 0;
    let windStrength = 0.35;
    let currentMood = 'morning';
    let currentMode = 'creator';

    const moodConfig = {
        morning: { background: 0xdcebd6, fog: 0xdcebd6, groundTint: 0xffffff },
        day: { background: 0xcfe6e3, fog: 0xcfe6e3, groundTint: 0xf4fff7 },
        evening: { background: 0xf0d8c6, fog: 0xf0d8c6, groundTint: 0xffead8 }
    };

    const api = {
        scene,
        groundGroup,
        groundSurface: surface,
        groundDais: dais,
        gardenRoot,
        creatorRoot,
        lights,
        plants,
        addPlant(id, object) {
            if (!object) return;
            if (object.parent === gardenRoot) return;
            gardenRoot.add(object);
            plants.set(id, object);
        },
        removePlant(id) {
            const obj = plants.get(id);
            if (!obj) return null;
            if (obj.parent === gardenRoot) gardenRoot.remove(obj);
            plants.delete(id);
            return obj;
        },
        getPlant(id) {
            return plants.get(id) || null;
        },
        getAllPlantObjects() {
            return [...plants.values()];
        },
        hasPlant(id) {
            return plants.has(id);
        },
        clearPlants() {
            for (const id of [...plants.keys()]) {
                const obj = api.removePlant(id);
                if (obj) disposeObjectSafe(obj);
            }
            plants.clear();
        },
        setPreview(object) {
            if (previewObject === object) return;
            if (previewObject) {
                if (previewObject.parent === creatorRoot) creatorRoot.remove(previewObject);
                disposeObjectSafe(previewObject);
                previewObject = null;
            }
            if (object) {
                creatorRoot.add(object);
                previewObject = object;
            }
        },
        getPreview() {
            return previewObject;
        },
        clearPreview() {
            if (previewObject) {
                if (previewObject.parent === creatorRoot) creatorRoot.remove(previewObject);
                disposeObjectSafe(previewObject);
                previewObject = null;
            }
        },
        setEnvironment({ mood, wind } = {}) {
            if (typeof wind === 'number' && Number.isFinite(wind)) {
                windStrength = THREE.MathUtils.clamp(wind, 0, 1);
            }
            if (mood && moodConfig[mood]) {
                currentMood = mood;
                const config = moodConfig[currentMood];
                scene.background.setHex(config.background);
                scene.fog.color.setHex(config.fog);
                if (dais.material?.color) dais.material.color.setHex(config.groundTint);
                lights.setMood?.(currentMood);
            }
        },
        setMode(mode) {
            currentMode = mode === 'garden' ? 'garden' : 'creator';
            gardenRoot.visible = currentMode === 'garden';
            creatorRoot.visible = currentMode === 'creator';
        },
        wake(object) {
            if (!object) return;
            object.userData.wakeImpulse = 1;
        },
        update(dt) {
            elapsed += dt;
            if (currentMode === 'creator') {
                if (previewObject) animatePlant(previewObject, dt);
            } else {
                for (const object of plants.values()) animatePlant(object, dt);
            }
        },
        dispose() {
            api.clearPlants();
            api.clearPreview();
            lights && lights.directional && lights.directional.dispose && lights.directional.dispose();
            // 共享材质由 material 模块自己管，这里不释放
        }
    };

    api.setMode(currentMode);
    return api;

    function animatePlant(object, dt) {
        if (object.userData.baseRotationX == null) {
            object.userData.baseRotationX = object.rotation.x;
            object.userData.baseRotationZ = object.rotation.z;
        }
        const phase = Number(object.userData.windPhase) || 0;
        const wake = Math.max(0, Number(object.userData.wakeImpulse) || 0);
        const amount = (windStrength * 0.032) + (wake * 0.075);
        object.rotation.z = object.userData.baseRotationZ + Math.sin(elapsed * (1.15 + windStrength) + phase) * amount;
        object.rotation.x = object.userData.baseRotationX + Math.cos(elapsed * 0.82 + phase * 0.7) * amount * 0.42;
        if (wake > 0) object.userData.wakeImpulse = Math.max(0, wake - dt * 1.65);
    }
}

/**
 * 安全释放对象（含 children 几何/纹理），跳过共享材质标记。
 */
function disposeObjectSafe(object) {
    if (!object) return;
    if (object.userData && object.userData.disposed) return;
    object.traverse(function (child) {
        if (child.geometry && !child.geometry.userData?.shared && !child.geometry.userData?.disposed) {
            child.geometry.dispose();
            child.geometry.userData = child.geometry.userData || {};
            child.geometry.userData.disposed = true;
        }
        if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            for (const m of mats) {
                if (!m) continue;
                if (m.userData && (m.userData.shared || m.userData.disposed)) continue;
                if (typeof m.dispose === 'function') {
                    m.userData = m.userData || {};
                    m.userData.disposed = true;
                    m.dispose();
                }
            }
        }
    });
    object.userData = object.userData || {};
    object.userData.disposed = true;
}
