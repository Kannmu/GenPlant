import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

import { createStore } from '../core/store.js';
import { encodeState, decodeState } from '../core/seed.js';
import { randomBaseSeed, SLIDERS } from '../state/defaults.js';
import { createTemplateLibrary } from '../state/templates.js';
import { writePlantSeedToURL, writeGardenToURL, saveGarden, loadGarden, readFromURL } from '../state/persistence.js';
import { debounce, copyToClipboard } from '../util/dom.js';
import { createLivePreviewScheduler } from '../util/previewScheduler.js';
import { GARDEN_CONFIG } from '../config/constants.js';
import { generate } from '../generator/index.js';
import { createPlantFactory } from '../generator/PlantFactory.js';
import { disposeSharedMaterials } from '../generator/material.js';
import { disposeFoliageResources } from '../generator/foliage.js';
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

export function createApp() {
    const urlState = readFromURL();
    let initialBaseSeed = randomBaseSeed();
    let initialParams = null;
    if (urlState.plantSeed) {
        const decoded = decodeState(urlState.plantSeed);
        initialBaseSeed = decoded.baseSeed;
        initialParams = decoded.params;
    }

    const initialGarden = (urlState.garden?.length ? urlState.garden : loadGarden()) || [];
    const store = createStore({
        mode: 'creator',
        baseSeed: initialBaseSeed,
        params: initialParams || undefined
    });
    const templateLibrary = createTemplateLibrary();
    templateLibrary.importSeeds(initialGarden);

    const canvas = document.getElementById('three-canvas');
    if (!canvas) throw new Error('canvas #three-canvas not found');

    const engine = createEngine(canvas);
    const { sceneManager, cameraRig } = engine;
    const picker = createRaycastPicker(cameraRig.camera);
    const selection = createSelection();
    const growthAnimator = createGrowthAnimator();
    engine.addUpdater(growthAnimator.update);
    engine.addUpdater(selection.update);

    const pendingActions = {};
    const ui = createUIController(store, pendingActions);
    const plantFactory = createPlantFactory();
    const gardenManager = createGardenManager({
        sceneManager,
        growthAnimator,
        selection,
        toast: ui.toast,
        createPlant: (baseSeed, params, style) => plantFactory.create(baseSeed, params, style),
        onPlantsChanged: (size, garden) => {
            ui.setUndoEnabled(gardenManager.canUndo());
            ui.setDeleteEnabled(!!selection.get());
            ui.setGardenCount(size);
            writeGardenToURL(garden);
            saveGarden(garden);
        }
    });
    let diagnosticsElapsed = 0;
    const removeDiagnosticsUpdater = engine.addUpdater(dt => {
        diagnosticsElapsed += dt;
        if (diagnosticsElapsed < 0.5) return;
        diagnosticsElapsed = 0;
        const stats = engine.getStats();
        canvas.dataset.renderCalls = String(stats.calls);
        canvas.dataset.triangles = String(stats.triangles);
        canvas.dataset.geometries = String(stats.geometries);
        canvas.dataset.plants = String(gardenManager.size());
        if (gardenManager.size() > 0) {
            const bounds = new THREE.Box3().setFromObject(sceneManager.gardenRoot);
            const size = bounds.getSize(new THREE.Vector3());
            canvas.dataset.gardenSize = `${size.x.toFixed(1)},${size.y.toFixed(1)},${size.z.toFixed(1)}`;
        }
        canvas.dataset.cameraDistance = cameraRig.camera.position.distanceTo(cameraRig.controls.target).toFixed(1);
    });

    let previewRevision = 0;
    const creatorController = createCreatorController({
        sceneManager,
        cameraRig,
        onPreviewChanged: () => engine.renderer.requestShadowUpdate(),
        onPreviewGenerated({ quality, generationMs }) {
            canvas.dataset.previewRevision = String(++previewRevision);
            canvas.dataset.previewQuality = quality;
            canvas.dataset.previewGenerationMs = generationMs.toFixed(1);
        }
    });
    const gardenController = createGardenController({
        store,
        sceneManager,
        gardenManager,
        selection,
        picker,
        toast: ui.toast,
        getPlacementDescriptor: () => templateLibrary.resolve(templateLibrary.getActive()),
        createPlant: (baseSeed, params, style) => plantFactory.create(baseSeed, params, style)
    });
    const pointerSystem = createPointerSystem(canvas);

    const moods = [
        { key: 'morning', label: '晨光' },
        { key: 'day', label: '晴昼' },
        { key: 'evening', label: '夕照' }
    ];
    const winds = [
        { value: GARDEN_CONFIG.WIND_LEVELS[0], label: '静止' },
        { value: GARDEN_CONFIG.WIND_LEVELS[1], label: '微风' },
        { value: GARDEN_CONFIG.WIND_LEVELS[2], label: '清风' }
    ];
    let moodIndex = 0;
    let windIndex = 1;
    let editingTemplateId = null;
    let creatorView = null;
    let gardenView = null;
    let hasActivatedCreator = false;
    let hasActivatedGarden = false;

    const livePreview = createLivePreviewScheduler(() => {
        const state = store.getState();
        creatorController.regeneratePreview(state.baseSeed, state.params, { previewQuality: true });
    }, 48);

    function regenPreviewNow() {
        const state = store.getState();
        creatorController.regeneratePreview(state.baseSeed, state.params, { previewQuality: false });
    }

    function frameGarden() {
        if (gardenManager.size() === 0) {
            cameraRig.reset();
            return;
        }
        cameraRig.frameObject(
            sceneManager.gardenRoot,
            window.innerWidth < 600 ? 1.95 : 1.7,
            window.innerWidth < 600 ? 150 : 220
        );
    }

    const modeManager = createModeManager({
        store,
        onActivateGarden(active) {
            if (!active) {
                if (hasActivatedGarden) gardenView = cameraRig.getView();
                pointerSystem.setTapHandler(null);
                return;
            }
            hasActivatedGarden = true;
            sceneManager.setMode('garden');
            engine.renderer.requestShadowUpdate();
            gardenController.clearSelection();
            pointerSystem.setTapHandler((x, y) => gardenController.onPointerTap(x, y));
            cameraRig.setAutoRotate(false);
            if (!cameraRig.setView(gardenView)) frameGarden();
        },
        onActivateCreator(active) {
            if (!active) {
                livePreview.cancel();
                if (hasActivatedCreator) creatorView = cameraRig.getView();
                pointerSystem.setTapHandler(null);
                cameraRig.setAutoRotate(false);
                return;
            }
            hasActivatedCreator = true;
            sceneManager.setMode('creator');
            engine.renderer.requestShadowUpdate();
            gardenController.clearSelection();
            pointerSystem.setTapHandler(() => creatorController.wake());
            if (!creatorController.getDescriptor()) regenPreviewNow();
            cameraRig.setAutoRotate(true);
            if (!cameraRig.setView(creatorView)) creatorController.focus();
        }
    });

    function syncTemplateUI() {
        const templates = templateLibrary.list();
        const active = templateLibrary.getActive();
        ui.renderTemplates(templates, active?.id || null);
        const activeIndex = active ? templates.findIndex(template => template.id === active.id) : -1;
        ui.setActiveTemplate(active ? {
            ...active,
            specimen: `ARCHIVE ${String(activeIndex + 1).padStart(3, '0')}`
        } : null);
        ui.setGardenPlaceEnabled(!!active);
        const descriptor = templateLibrary.resolve(active);
        if (descriptor) {
            const schedule = window.requestIdleCallback || (callback => setTimeout(callback, 0));
            schedule(() => plantFactory.warm(descriptor.baseSeed, descriptor.params, descriptor.materialStyle));
        }
    }

    const unsubscribeTemplates = templateLibrary.subscribe(syncTemplateUI);
    syncTemplateUI();

    for (const entry of initialGarden) {
        const decoded = decodeState(entry.seed);
        const group = plantFactory.create(decoded.baseSeed, decoded.params, 'standard');
        if (!group) continue;
        gardenManager.placeAt(group, decoded.baseSeed, decoded.params, 'standard', entry.x, entry.z, {
            rotationY: entry.rotationY,
            recordUndo: false,
            animate: false,
            notify: false
        });
    }
    ui.setGardenCount(gardenManager.size());

    function clearEditingTemplate() {
        editingTemplateId = null;
        ui.setEditingTemplate(null);
    }

    function mutateCurrent() {
        const state = store.getState();
        const nextSeed = ((Math.imul(state.baseSeed >>> 0, 1664525) + 1013904223) >>> 0) || 1;
        const random = makeMulberry32(nextSeed);
        const candidates = SLIDERS.filter(meta => !['levels', 'branchesPerSplitMin', 'branchesPerSplitMax', 'palette'].includes(meta.key));
        const patch = {};
        for (let i = 0; i < 3; i++) {
            const meta = candidates[Math.floor(random() * candidates.length)];
            const current = Number(state.params[meta.key]);
            const delta = (random() - 0.5) * (meta.max - meta.min) * 0.18;
            patch[meta.key] = THREE.MathUtils.clamp(current + delta, meta.min, meta.max);
        }
        store.setBaseSeed(nextSeed);
        store.patchParams(patch);
    }

    async function shareCurrent() {
        const state = store.getState();
        const descriptor = state.mode === 'garden'
            ? templateLibrary.resolve(templateLibrary.getActive())
            : { baseSeed: state.baseSeed, params: state.params };
        if (!descriptor) {
            ui.toast.show('植物库中还没有模板');
            return;
        }
        const seed = encodeState(descriptor);
        const url = `${window.location.origin}${window.location.pathname}#s=${seed}`;
        const ok = await copyToClipboard(`${seed}  ${url}`);
        ui.toast.show(ok ? '分享链接已复制' : '复制失败，请手动复制种子');
    }

    function exportCurrent() {
        const selected = selection.get();
        const preview = sceneManager.getPreview();
        const target = store.getState().mode === 'garden' ? selected?.group : preview;
        if (!target) {
            ui.toast.show(store.getState().mode === 'garden' ? '请先选择一株植物' : '没有可导出的植物');
            return;
        }
        doExport(target, `genplant_${store.getState().baseSeed}`);
    }

    const actions = {
        onSeedChange() {
            clearEditingTemplate();
            if (store.getState().mode === 'creator') regenPreviewNow();
        },
        onRandomSeed() {
            clearEditingTemplate();
            store.setBaseSeed(randomBaseSeed());
            regenPreviewNow();
            ui.toast.show('新的造物草稿', 1000);
        },
        onMutate() {
            clearEditingTemplate();
            mutateCurrent();
            regenPreviewNow();
            ui.toast.show('已生成一个变体', 1100);
        },
        onSaveTemplate() {
            const state = store.getState();
            const wasEditing = !!editingTemplateId;
            const template = templateLibrary.save(state, editingTemplateId);
            editingTemplateId = template.id;
            ui.setEditingTemplate(template.id);
            ui.toast.show(wasEditing ? '模板已更新' : '模板已保存', 1100);
        },
        onGenerate() {
            const started = performance.now();
            const descriptor = templateLibrary.resolve(templateLibrary.getActive());
            if (!descriptor) {
                ui.toast.show('请先从植物库选择一个模板');
                return;
            }
            const target = cameraRig.getTarget();
            const position = gardenManager.findOpenPosition(target.x, target.z);
            if (!position) {
                ui.toast.show('圆台上没有足够的种植空间', 1600);
                return;
            }
            if (gardenController.placeAt(position.x, position.z)) {
                canvas.dataset.lastPlacementMs = (performance.now() - started).toFixed(1);
                ui.toast.show('已放置', 800);
            }
        },
        onSelectTemplate(id) {
            const template = templateLibrary.select(id);
            if (template) ui.toast.show(`已选择 ${template.name}`, 800);
        },
        onEditTemplate(id) {
            const descriptor = templateLibrary.resolve(id);
            if (!descriptor) return;
            editingTemplateId = id;
            ui.setEditingTemplate(id);
            store.replaceAll({ baseSeed: descriptor.baseSeed, params: descriptor.params, mode: 'creator' });
            regenPreviewNow();
            modeManager.activate('creator');
            ui.reflectMode('creator');
        },
        onDeleteTemplate(id) {
            const template = templateLibrary.get(id);
            if (!template) return;
            templateLibrary.remove(id);
            if (editingTemplateId === id) clearEditingTemplate();
            ui.toast.show(`${template.name} 已从植物库移除`, 1100);
        },
        onUndo() { gardenController.onUndo(); },
        onDelete() { gardenController.onDelete(); },
        onClear() {
            gardenController.onClear();
            ui.toast.show('花园已清空', 1000);
        },
        onResetCamera() {
            if (store.getState().mode === 'creator') {
                creatorView = null;
                creatorController.focus();
            } else {
                gardenView = null;
                frameGarden();
            }
        },
        onExport() { exportCurrent(); },
        onShare() { shareCurrent(); },
        onParamsLiveChange() { livePreview.schedule(); },
        onParamsCommit() {
            livePreview.cancel();
            if (store.getState().mode === 'creator') regenPreviewNow();
        },
        onMoodChange() {
            moodIndex = (moodIndex + 1) % moods.length;
            const mood = moods[moodIndex];
            sceneManager.setEnvironment({ mood: mood.key });
            return mood;
        },
        onWindChange() {
            windIndex = (windIndex + 1) % winds.length;
            const wind = winds[windIndex];
            sceneManager.setEnvironment({ wind: wind.value });
            return wind;
        },
        onModeChange(mode) {
            modeManager.activate(mode);
            ui.reflectMode(mode);
        }
    };
    Object.assign(pendingActions, actions);

    sceneManager.setEnvironment({ mood: moods[moodIndex].key, wind: winds[windIndex].value });
    ui.setMoodState(moods[moodIndex]);
    ui.setWindState(winds[windIndex]);
    ui.setEditingTemplate(null);

    const writeURLDebounced = debounce(() => {
        const state = store.getState();
        writePlantSeedToURL(encodeState({ baseSeed: state.baseSeed, params: state.params }));
    }, 250);
    const unsubscribeStore = store.subscribe(() => writeURLDebounced());

    engine.onContextRestored = function onContextRestored() {
        const snapshot = gardenManager.serialize();
        gardenManager.clear();
        let index = 0;
        function rebuildBatch() {
            for (let i = 0; i < GARDEN_CONFIG.MAX_RESTORE_PER_FRAME && index < snapshot.length; i++, index++) {
                const entry = snapshot[index];
                const decoded = decodeState(entry.seed);
                const group = plantFactory.create(decoded.baseSeed, decoded.params, 'standard');
                if (!group) continue;
                gardenManager.placeAt(group, decoded.baseSeed, decoded.params, 'standard', entry.x, entry.z, {
                    rotationY: entry.rotationY,
                    recordUndo: false,
                    animate: false,
                    notify: false
                });
            }
            if (index < snapshot.length) requestAnimationFrame(rebuildBatch);
            else {
                gardenManager.fireChanged();
                if (store.getState().mode === 'creator') regenPreviewNow();
            }
        }
        rebuildBatch();
        ui.toast.show('场景已恢复', 1500);
    };

    ui.reflectMode(store.getState().mode);
    engine.start();

    const api = {
        engine,
        store,
        ui,
        templateLibrary,
        gardenManager,
        getStats() {
            return { ...engine.getStats(), plants: gardenManager.size(), templates: templateLibrary.list().length };
        },
        dispose
    };
    return api;

    function dispose() {
        livePreview.cancel();
        writeURLDebounced.cancel();
        unsubscribeTemplates();
        unsubscribeStore();
        removeDiagnosticsUpdater();
        pointerSystem.dispose();
        gardenManager.dispose();
        engine.dispose();
        disposeFoliageResources();
        plantFactory.dispose();
        disposeSharedMaterials();
    }
}

function generatePlantSafe(baseSeed, params, materialStyle = 'standard') {
    try {
        return generate(baseSeed, params, { materialStyle });
    } catch (error) {
        console.error('Plant generation failed:', error);
        return null;
    }
}

function makeMulberry32(seed) {
    return function random() {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
        value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

function doExport(object, fileBase) {
    const exporter = new GLTFExporter();
    exporter.parse(
        object,
        result => {
            const blob = result instanceof ArrayBuffer
                ? new Blob([result], { type: 'application/octet-stream' })
                : new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
            saveBlob(blob, `${fileBase}.${result instanceof ArrayBuffer ? 'glb' : 'gltf'}`);
        },
        error => console.error('export failed', error),
        { binary: true, onlyVisible: true, truncateDrawRange: true }
    );
}

function saveBlob(blob, filename) {
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
}
