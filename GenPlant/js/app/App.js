import * as THREE from "https://esm.sh/three";
import { GLTFExporter } from 'https://esm.sh/three/examples/jsm/exporters/GLTFExporter.js';

import { createStore } from '../core/store.js';
import { encodeState, decodeState } from '../core/seed.js';
import { randomBaseSeed } from '../state/defaults.js';
import { writePlantSeedToURL, writeGardenToURL, saveGarden, loadGarden, readFromURL } from '../state/persistence.js';
import { debounce, copyToClipboard } from '../util/dom.js';
import { GENERATOR_CONFIG, GARDEN_CONFIG } from '../config/constants.js';
import { generate } from '../generator/index.js';
import { createEngine } from '../three/Engine.js';
import { createUIController } from '../ui/UIController.js';
import { createPointerSystem } from '../interaction/PointerSystem.js';
import { createRaycastPicker } from '../interaction/RaycastPicker.js';
import { createSelection } from '../interaction/Selection.js';
import { createGrowthAnimator } from '../garden/GrowthAnimator.js';
import { createGardenManager } from '../garden/GardenManager.js';
import { createGardenController } from '../interaction/GardenController.js';
import { createCreatorController } from '../interaction/CreatorController.js';
import { createModeManager } from './ModeManager.js';
import { disposeSharedMaterials } from '../generator/material.js';

/**
 * App：组装一切。init 顺序：store -> engine -> pickers/anim -> manager ->
 *   controllers -> 再把 actions 填给 UIController -> UIController -> modeManager -> 初始花园 -> start。
 */
export function createApp() {
    // ---- 读 URL 初始状态 ----
    const urlState = readFromURL();
    let initialBaseSeed = randomBaseSeed();
    let initialParams = null;
    if (urlState.plantSeed) {
        try {
            const dec = decodeState(urlState.plantSeed);
            initialBaseSeed = dec.baseSeed;
            initialParams = dec.params;
        } catch (e) { /* keep defaults */ }
    }

    const store = createStore({
        mode: 'creator',
        baseSeed: initialBaseSeed,
        params: initialParams || undefined
    });

    const canvas = document.getElementById('three-canvas');
    if (!canvas) throw new Error('canvas #three-canvas not found');

    const engine = createEngine(canvas);
    const { sceneManager, cameraRig } = engine;

    const picker = createRaycastPicker(cameraRig.camera);
    const selection = createSelection();
    const growthAnimator = createGrowthAnimator();
    engine.addUpdater(growthAnimator.update);
    engine.addUpdater(selection.update);

    // ---- 工具/依赖需要在 UIController 之前就存在（toast） ----
    // 先建一个临时 toast stub，再由 UIController 替换实现 —— 但 GardenManager 需要 toast.show。
    // 为简单：先建 UIController 时 actions 用一个临时对象，事后回填。
    const pendingActions = {};
    const ui = createUIController(store, pendingActions);

    const gardenManager = createGardenManager({
        sceneManager, growthAnimator, selection, toast: ui.toast,
        onPlantsChanged: (size, garden) => {
            ui.setUndoEnabled(gardenManager.canUndo());
            ui.setDeleteEnabled(!!selection.get());
            writeGardenToURL(garden);
            saveGarden(garden);
        }
    });

    const gardenController = createGardenController({
        store, sceneManager, gardenManager, selection, cameraRig, picker,
        toast: ui.toast,
        getAnchorSeed: () => store.getState().baseSeed
    });

    const creatorController = createCreatorController({ sceneManager, cameraRig });

    const pointerSystem = createPointerSystem(canvas);

    // ---- 预览重生成 ----
    const regenPreviewDebounced = debounce(() => {
        const st = store.getState();
        creatorController.regeneratePreview(st.baseSeed, st.params, { previewQuality: false });
    }, 90);

    function regenPreviewNow(materialStyle) {
        const st = store.getState();
        creatorController.regeneratePreview(st.baseSeed, st.params, {
            previewQuality: false,
            materialStyle: materialStyle
        });
    }

    // ---- 模式切换 ----
    function refocusGarden() {
        const c = gardenCentroid(gardenManager.getAll());
        cameraRig.setTarget(c);
    }

    const modeManager = createModeManager({
        store,
        onActivateGarden: (active) => {
            if (active) {
                creatorController.clearPreview();
                pointerSystem.setTapHandler((x, y) => gardenController.onPointerTap(x, y));
                cameraRig.setAutoRotate(false);
                refocusGarden();
            } else {
                pointerSystem.setTapHandler(null);
            }
        },
        onActivateCreator: (active) => {
            if (active) {
                selection.clear();
                pointerSystem.setTapHandler(null);
                regenPreviewNow('standard');
                cameraRig.setAutoRotate(true);
                cameraRig.setTarget(new THREE.Vector3(0, sceneManager.groundSurface.position.y, 0));
            } else {
                cameraRig.setAutoRotate(false);
            }
        }
    });

    // ---- 现在回填 actions 给 UIController ----
    function onGenerateGardenPlace() {
        const st = store.getState();
        const c = gardenCentroid(gardenManager.getAll());
        const prng = makeMulberry32(st.baseSeed >>> 0);
        const offsetR = 6 + prng() * 12;
        const ang = prng() * Math.PI * 2;
        const group = generatePlantSafe(st.baseSeed, st.params);
        if (!group) { ui.toast.show('生成失败'); return; }
        gardenManager.placeAt(group, st.baseSeed, st.params, 'standard',
            c.x + Math.cos(ang) * offsetR, c.z + Math.sin(ang) * offsetR);
        refocusGarden();
    }

    function exportCurrent() {
        const sel = selection.get();
        const preview = sceneManager.getPreview();
        const targetGroup = sel ? sel.group : preview;
        if (!targetGroup) { ui.toast.show('没有可导出的植物'); return; }
        doExport(targetGroup, `genplant_${store.getState().baseSeed}`);
    }

    async function shareCurrent() {
        const st = store.getState();
        const str = encodeState({ baseSeed: st.baseSeed, params: st.params });
        const ok = await copyToClipboard(str + '  ' + window.location.origin + window.location.pathname + '#s=' + str);
        ui.toast.show(ok ? '分享链接已复制' : '复制失败，请手动复制种子');
    }

    // 全部 actions
    const actions = {
        onSeedChange(_str) {
            if (store.getState().mode === 'creator') regenPreviewNow('standard');
        },
        onRandomSeed() {
            store.setBaseSeed(randomBaseSeed());
            ui.syncSeedInputFromState();
            if (store.getState().mode === 'creator') regenPreviewNow('standard');
            else refocusGarden();
            ui.toast.show('新种子', 1000);
        },
        onGenerate() {
            if (store.getState().mode === 'creator') regenPreviewNow('standard');
            else onGenerateGardenPlace();
        },
        onPlantInGarden() {
            const desc = creatorController.getDescriptor();
            if (!desc) { ui.toast.show('请先用滑块生成一株'); return; }
            const target = cameraRig.getTarget();
            const group = generatePlantSafe(desc.baseSeed, desc.params);
            if (!group) { ui.toast.show('生成失败'); return; }
            gardenManager.placeAt(group, desc.baseSeed, desc.params, desc.materialStyle, target.x, target.z);
            ui.toast.show('已种入花园', 1300);
        },
        onUndo() { gardenController.onUndo(); },
        onDelete() { gardenController.onDelete(); },
        onClear() { gardenController.onClear(); ui.toast.show('花园已清空', 1200); },
        onResetCamera() { cameraRig.reset(); refocusGarden(); },
        onExport() { exportCurrent(); },
        onShare() { shareCurrent(); },
        onParamsLiveChange() { regenPreviewDebounced(); },
        onModeChange(mode) {
            modeManager.activate(mode);
            ui.reflectMode(mode);
        }
    };
    Object.assign(pendingActions, actions);

    // ---- store 订阅：单植物 seed -> URL ----
    const urlDebounced = debounce(() => {
        const st = store.getState();
        writePlantSeedToURL(encodeState({ baseSeed: st.baseSeed, params: st.params }));
    }, 250);
    store.subscribe(() => urlDebounced());

    // ---- context-loss 恢复：逐帧重生 ----
    engine.onContextRestored = function () {
        const snapshot = gardenManager.serialize();
        gardenManager.clear();
        let idx = 0;
        function rebuildBatch() {
            const N = GARDEN_CONFIG.MAX_RESTORE_PER_FRAME;
            for (let i = 0; i < N && idx < snapshot.length; i++, idx++) {
                const p = snapshot[idx];
                const dec = decodeState(p.seed);
                const group = generatePlantSafe(dec.baseSeed, dec.params);
                if (!group) continue;
                gardenManager.placeAt(group, dec.baseSeed, dec.params, 'standard',
                    p.x, p.z, { rotationY: p.rotationY });
            }
            if (idx < snapshot.length) requestAnimationFrame(rebuildBatch);
            else {
                refocusGarden();
                if (store.getState().mode === 'creator') regenPreviewNow('standard');
            }
        }
        rebuildBatch();
        ui.toast.show('已从上下文丢失恢复', 1800);
    };

    // ---- 初始花园：localStorage / URL ----
    const persisted = loadGarden() || [];
    const initialGarden = (urlState.garden && urlState.garden.length) ? urlState.garden : persisted;
    if (initialGarden && initialGarden.length) {
        for (const p of initialGarden) {
            try {
                const dec = decodeState(p.seed);
                const group = generatePlantSafe(dec.baseSeed, dec.params);
                if (group) gardenManager.placeAt(group, dec.baseSeed, dec.params, 'standard',
                    p.x, p.z, { rotationY: p.rotationY });
            } catch (e) { console.warn('initial garden entry skipped:', e); }
        }
    }

    // ---- 启动 ----
    ui.reflectMode(store.getState().mode);
    engine.start();
    regenPreviewNow('standard');

    // 若 urlState 带植物 seed 且此时在造物模式 → 已通过 regenPreviewNow 体现；若花园非空则切到花园模式更友好
    if (gardenManager.size() > 0 && !urlState.plantSeed) {
        // 保留 creator，但聚焦花园质心
    }

    return { engine, store, ui, dispose };

    function dispose() {
        pointerSystem.dispose();
        engine.dispose();
        disposeSharedMaterialsSafe();
    }
}

// ---- helpers ----

function disposeSharedMaterialsSafe() {
    try { disposeSharedMaterials(); } catch (e) {}
}

function gardenCentroid(instances) {
    const c = new THREE.Vector3();
    if (!instances || instances.length === 0) { c.set(0, 0, 0); return c; }
    for (const inst of instances) {
        const p = new THREE.Vector3();
        inst.group.getWorldPosition(p);
        c.add(p);
    }
    c.multiplyScalar(1 / instances.length);
    return c;
}

function generatePlantSafe(baseSeed, params) {
    try {
        return generate(baseSeed, params, { materialStyle: 'standard' });
    } catch (err) {
        console.error('generatePlantSafe failed:', err);
        return null;
    }
}

function makeMulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function doExport(object, fileBase) {
    const exporter = new GLTFExporter();
    exporter.parse(
        object,
        function (result) {
            if (result instanceof ArrayBuffer) {
                saveArrayBuffer(result, fileBase + '.glb');
            } else {
                saveString(JSON.stringify(result, null, 2), fileBase + '.gltf');
            }
        },
        function (error) { console.error('export failed', error); },
        { binary: true, onlyVisible: true, truncateDrawRange: true }
    );
}

function saveString(text, filename) {
    save(new Blob([text], { type: 'text/plain' }), filename);
}
function saveArrayBuffer(buffer, filename) {
    save(new Blob([buffer], { type: 'application/octet-stream' }), filename);
}
function save(blob, filename) {
    const link = document.createElement('a');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}