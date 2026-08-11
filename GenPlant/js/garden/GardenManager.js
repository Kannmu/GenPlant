import * as THREE from "three";
import { GARDEN_CONFIG, RENDERER_CONFIG } from '../config/constants.js';
import { createPlantInstance } from './PlantInstance.js';
import { encodeState } from '../core/seed.js';

/**
 * GardenManager：花园植物的逻辑管理者。
 * 唯一写入花园列表者。负责：
 *   - placeAt(baseSeed, params, hitPoint, options) 放置新植物
 *   - removeById(id), undo(), clear()
 *   - serialize() / deserialize() 用于分享与持久化
 *   - 与 SceneManager / GrowthAnimator / Selection 协作
 *
 * 放置规则：植物 bottom 落在 groundSurface.y（由 PlantInstance 处理），
 * 这里只给定 x/z（来自 raycast 命中点）和由 baseSeed PRNG 派生的随机 rotationY。
 *
 * 注：renderEnv 暂未实现，跳过，直接用一个本地 mulberry32。
 */
export function createGardenManager({ sceneManager, growthAnimator, selection, toast, onPlantsChanged, createPlant }) {
    const instances = new Map();   // id -> instance
    const undoStack = [];          // { action, payload }
    let restoreQueue = [];          // context-loss 后逐帧重生用
    let processingRestore = false;
    let sessionPrng = makeMulberry32(Math.floor(Math.random() * 1e9) >>> 0);
    let batchDepth = 0;
    let pendingChange = false;

    const api = {
        get instances() { return instances; },
        size() { return instances.size; },
        get(id) { return instances.get(id) || null; },
        getAll() { return [...instances.values()]; },
        canPlaceAt(x, z) { return isWithinPlantingArea(x, z); },
        findOpenPosition(x, z, minDistance = 9) {
            const origin = clampToPlantingArea(x, z);
            const occupied = (px, pz) => [...instances.values()].some(instance => {
                const dx = instance.descriptor.x - px;
                const dz = instance.descriptor.z - pz;
                return dx * dx + dz * dz < minDistance * minDistance;
            });
            if (!occupied(origin.x, origin.z)) return origin;
            const maxRings = Math.ceil((getPlantingRadius() * 2) / minDistance);
            for (let ring = 1; ring <= maxRings; ring++) {
                const radius = minDistance * ring;
                const samples = 8 + ring * 4;
                for (let i = 0; i < samples; i++) {
                    const angle = (i / samples) * Math.PI * 2;
                    const px = origin.x + Math.cos(angle) * radius;
                    const pz = origin.z + Math.sin(angle) * radius;
                    if (isWithinPlantingArea(px, pz) && !occupied(px, pz)) return { x: px, z: pz };
                }
            }
            return null;
        },

        /**
         * 放置一株植物到给定 x,z
         * @returns instance or null
         */
        placeAt(group, baseSeed, params, materialStyle, x, z, opts = {}) {
            if (!isWithinPlantingArea(x, z)) {
                toast && toast.show('只能种植在圆台范围内', 1800);
                disposeGroup(group);
                return null;
            }
            if (instances.size >= GARDEN_CONFIG.MAX_PLANTS) {
                toast && toast.show(`已达上限 ${GARDEN_CONFIG.MAX_PLANTS} 株，删去一些再放`, 2600);
                disposeGroup(group);
                return null;
            }
            const rotationY = opts.rotationY != null
                ? opts.rotationY
                : sessionPrng() * Math.PI * 2;
            const instance = createPlantInstance({ group, baseSeed, params, materialStyle, x, z, rotationY });
            instance.descriptor.seed = encodeState({ baseSeed, params });
            sceneManager.addPlant(instance.id, group);
            // enableShadows 已经在生成侧？这里再确保一遍
            enableShadowsForPlant(group);
            instances.set(instance.id, instance);
            if (opts.animate === false) {
                instance.growing = false;
                instance.growth = 1;
                instance.group.userData.finalScale = instance.group.scale.x || 1;
            } else {
                growthAnimator.start(instance);
            }
            if (opts.recordUndo !== false) pushUndo({ action: 'add', id: instance.id });
            if (opts.notify !== false) fireChanged();
            return instance;
        },

        removeById(id, recordUndo = true) {
            const inst = instances.get(id);
            if (!inst) return false;
            const descriptor = {
                baseSeed: inst.baseSeed,
                params: { ...inst.params },
                materialStyle: inst.materialStyle,
                x: inst.descriptor.x,
                z: inst.descriptor.z,
                rotationY: inst.descriptor.rotationY
            };
            growthAnimator.stop(inst);
            const obj = sceneManager.removePlant(id);
            if (obj) disposeGroup(obj);
            inst.disposed = true;
            instances.delete(id);
            if (selection.get() === inst) selection.clear();
            if (recordUndo) pushUndo({ action: 'remove', descriptor });
            fireChanged();
            return true;
        },

        undo() {
            const entry = undoStack.pop();
            if (!entry) return false;
            if (entry.action === 'add') {
                api.removeById(entry.id, false);
            } else if (entry.action === 'remove') {
                const d = entry.descriptor;
                const group = typeof createPlant === 'function'
                    ? createPlant(d.baseSeed, d.params, d.materialStyle)
                    : null;
                if (!group) return false;
                api.placeAt(group, d.baseSeed, d.params, d.materialStyle, d.x, d.z, {
                    rotationY: d.rotationY,
                    recordUndo: false,
                    animate: false
                });
            }
            return true;
        },

        /**
         * 从已序列化描述符重建一株植物（用于 deserialize / context-loss 恢复）
         * caller 负责先生成 group。
         */
        restoreInstance(instance) {
            if (!instance || instance.disposed) return null;
            // 重建几何可能已 dispose 过；这里假设传入的是「全新生成」的 instance（见 fromDescriptor）
            sceneManager.addPlant(instance.id, instance.group);
            enableShadowsForPlant(instance.group);
            instances.set(instance.id, instance);
            // 不再播放生长动画（恢复场景应即时呈现）
            instance.growing = false;
            instance.growth = 1;
            if (instance.group.userData.finalScale) {
                instance.group.scale.setScalar(instance.group.userData.finalScale);
            }
            return instance;
        },

        clear() {
            batch(() => {
                for (const id of [...instances.keys()]) api.removeById(id, false);
                undoStack.length = 0;
            });
        },

        serialize() {
            return [...instances.values()].map(inst => ({
                seed: inst.descriptor.seed,
                x: inst.descriptor.x,
                z: inst.descriptor.z,
                rotationY: inst.descriptor.rotationY
            }));
        },

        canUndo() { return undoStack.length > 0; },

        fireChanged,
        dispose() {
            api.clear();
        }
    };

    function fireChanged() {
        if (batchDepth > 0) {
            pendingChange = true;
            return;
        }
        if (typeof onPlantsChanged === 'function') {
            try { onPlantsChanged(api.size(), api.serialize()); } catch (e) { console.error(e); }
        }
    }

    function pushUndo(entry) {
        undoStack.push(entry);
        if (undoStack.length > GARDEN_CONFIG.UNDO_STACK_SIZE) undoStack.shift();
    }

    function batch(work) {
        batchDepth++;
        try {
            work();
        } finally {
            batchDepth--;
            if (batchDepth === 0 && pendingChange) {
                pendingChange = false;
                fireChanged();
            }
        }
    }

    return api;
}

export function getPlantingRadius() {
    return Math.max(0.01, RENDERER_CONFIG.GROUND.RADIUS - GARDEN_CONFIG.PLACEMENT_EDGE_MARGIN);
}

export function isWithinPlantingArea(x, z) {
    const px = Number(x);
    const pz = Number(z);
    if (!Number.isFinite(px) || !Number.isFinite(pz)) return false;
    const radius = getPlantingRadius();
    return px * px + pz * pz <= radius * radius + 1e-8;
}

function clampToPlantingArea(x, z) {
    let px = Number.isFinite(Number(x)) ? Number(x) : 0;
    let pz = Number.isFinite(Number(z)) ? Number(z) : 0;
    const radius = getPlantingRadius();
    const distance = Math.hypot(px, pz);
    if (distance > radius && distance > 0) {
        const scale = radius / distance;
        px *= scale;
        pz *= scale;
    }
    return { x: px, z: pz };
}

function enableShadowsForPlant(group) {
    group.traverse(function (child) {
        if (child.isMesh) {
            child.castShadow = !child.isInstancedMesh;
            child.receiveShadow = child.isInstancedMesh;
        }
    });
}

function disposeGroup(group) {
    if (!group) return;
    if (group.userData?.disposed) return;
    group.traverse(function (child) {
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
    group.userData = group.userData || {};
    group.userData.disposed = true;
}

function makeMulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
