import * as THREE from "https://esm.sh/three";
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

    // 预览植物（造物模式），与花园植物分离管理
    let previewObject = null;

    // plant registry: id -> { object } 便于集中 dispose 与查找
    const plants = new Map();

    const api = {
        scene,
        groundGroup,
        groundSurface: surface,
        groundDais: dais,
        lights,
        plants,
        addPlant(id, object) {
            if (!object) return;
            if (object.parent === scene) return;
            scene.add(object);
            plants.set(id, object);
        },
        removePlant(id) {
            const obj = plants.get(id);
            if (!obj) return null;
            if (obj.parent === scene) scene.remove(obj);
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
                if (previewObject.parent === scene) scene.remove(previewObject);
                disposeObjectSafe(previewObject);
                previewObject = null;
            }
            if (object) {
                scene.add(object);
                previewObject = object;
            }
        },
        getPreview() {
            return previewObject;
        },
        clearPreview() {
            if (previewObject) {
                if (previewObject.parent === scene) scene.remove(previewObject);
                disposeObjectSafe(previewObject);
                previewObject = null;
            }
        },
        update(dt) {
            // 灯光/地面无 per-frame 自更新；预留扩展（如风吹）
            void dt;
        },
        dispose() {
            api.clearPlants();
            api.clearPreview();
            lights && lights.directional && lights.directional.dispose && lights.directional.dispose();
            // 共享材质由 material 模块自己管，这里不释放
        }
    };

    return api;
}

/**
 * 安全释放对象（含 children 几何/纹理），跳过共享材质标记。
 */
function disposeObjectSafe(object) {
    if (!object) return;
    if (object.userData && object.userData.disposed) return;
    object.traverse(function (child) {
        if (child.geometry && !child.geometry.userData?.disposed) {
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