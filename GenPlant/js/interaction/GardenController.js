import * as THREE from "https://esm.sh/three";
import { generate } from '../generator/index.js';

/**
 * GardenController：花园模式的交互策略。
 *   - tap 空地 → 在命中点放一株植物（用 store 当前 baseSeed+params，或随机）
 *   - tap 已有植物 → 选中
 *   - 选中后 Delete 工具删除；Undo 撤销最近放置/删除
 *
 * 提供方法（由 App 调用）：
 *   onPointerTap(x, y)
 *   onDelete(), onUndo(), onPlantInGarden()
 *   setActions(...)
 */
export function createGardenController({ store, sceneManager, gardenManager, selection, cameraRig, picker, toast, getAnchorSeed }) {
    function selectInstance(inst) {
        selection.select(inst);
        // 同步进 store，供 UI 反映删除按钮可用性
        store.setSelected(inst ? inst.id : null);
        cameraRig.setTarget(getInstanceCenter(inst));
    }

    const api = {
        onPointerTap(x, y) {
            if (engineContextLost()) return;

            const plants = gardenManager.getAll().map(i => i.group);
            const hit = picker.pickPlants(x, y, plants);
            if (hit && hit.object?.userData?.plantId) {
                const id = hit.object.userData.plantId;
                const inst = gardenManager.get(id);
                if (inst) {
                    selectInstance(inst);
                    return;
                }
            }

            // 点击空白先取消选中
            if (selection.get()) { selection.clear(); store.setSelected(null); }

            // 命中地面则放置
            const ground = picker.pickGround(x, y, sceneManager.groundSurface);
            if (!ground) return;
            placeAtGround(ground.x, ground.z);
        },

        onDelete() {
            const inst = selection.get();
            if (!inst) { toast.show('未选中植物'); return; }
            gardenManager.removeById(inst.id, true);
            selection.clear();
            store.setSelected(null);
            refocus();
        },

        onUndo() {
            gardenManager.undo();
            refocus();
        },

        onClear() {
            gardenManager.clear();
            selection.clear();
            store.setSelected(null);
            refocus();
        },

        /** 造物模式「种入花园」：在相机目标地面点放入当前预览参数 */
        onPlantInGarden(previewDescriptor) {
            // previewDescriptor: { baseSeed, params, materialStyle, group? }
            // 放在 camera target 投影到地面的位置
            const target = cameraRig.getTarget();
            tryPlaceDescriptor(previewDescriptor, target.x, target.z);
        }
    };

    function placeAtGround(x, z) {
        const st = store.getState();
        const baseSeed = getAnchorSeed ? getAnchorSeed() : st.baseSeed;
        const params = { ...st.params };
        let group;
        try {
            group = generate(baseSeed, params, { materialStyle: 'standard' });
        } catch (err) {
            console.error('place plant failed:', err);
            toast.show('放置失败，换个种子再试');
            return;
        }
        gardenManager.placeAt(group, baseSeed, params, 'standard', x, z);
        refocus();
    }

    function tryPlaceDescriptor(desc, x, z) {
        if (!desc) { toast.show('请先生成一株植物'); return; }
        let group;
        try {
            group = generate(desc.baseSeed, desc.params, { materialStyle: desc.materialStyle || 'standard' });
        } catch (err) {
            toast.show('生成失败');
            return;
        }
        gardenManager.placeAt(group, desc.baseSeed, desc.params, desc.materialStyle || 'standard', x, z);
        refocus();
    }

    function refocus() {
        // 选中时聚焦选中，否则聚焦花园质心
        const sel = selection.get();
        if (sel) {
            cameraRig.setTarget(getInstanceCenter(sel));
        } else {
            const c = gardenCentroid(gardenManager.getAll());
            cameraRig.setTarget(c);
        }
    }

    return api;
}

function getInstanceCenter(inst) {
    const v = new THREE.Vector3();
    inst.group.getWorldPosition(v);
    return v;
}

function gardenCentroid(instances) {
    if (!instances || instances.length === 0) return new THREE.Vector3(0, 0, 0);
    const c = new THREE.Vector3();
    for (const inst of instances) {
        const p = new THREE.Vector3();
        inst.group.getWorldPosition(p);
        c.add(p);
    }
    c.multiplyScalar(1 / instances.length);
    return c;
}

function engineContextLost() {
    // Engine 通过标志位控制；此处保守返回 false，App 在 contextLost 时禁用 PointerSystem
    return false;
}