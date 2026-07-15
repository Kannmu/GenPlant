import { SLIDERS } from '../state/defaults.js';
import { createSliders } from './Sliders.js';
import { createModeTabs } from './ModeTabs.js';
import { createPanel } from './Panel.js';
import { createToast } from './Toast.js';
import { encodeState, decodeState } from '../core/seed.js';
import { debounce, copyToClipboard } from '../util/dom.js';

/**
 * UIController：构建 overlay 控件并绑定到 store。
 * 它不直接持有 three.js 引用；通过回调把用户意图交给 App。
 *
 * 回调对象 actions:
 *   onSeedChange(seedStr, source)
 *   onRandomSeed()
 *   onGenerate()
 *   onPlantInGarden()
 *   onUndo(), onDelete(), onShare(), onExport(), onClear(), onResetCamera()
 *   onModeChange(mode)
 *   onParamsLiveChange()     // 滑块拖动中（debounce 由 App 处理）
 */
export function createUIController(store, actions = {}) {
    const $ = (id) => document.getElementById(id);
    const ids = {
        seedInput: $('seedInput'),
        seedForm: $('seedForm'),
        copySeed: $('copySeedBtn'),
        modeTabs: $('modeTabs'),
        creatorPanel: $('creatorPanel'),
        panelToggle: $('panelToggle'),
        sliders: $('sliders'),
        toolbar: $('toolbar'),
        toast: $('toast'),
        hint: $('hint'),
        randomBtn: $('randomBtn'),
        generateBtn: $('generateBtn'),
        plantInGardenBtn: $('plantInGardenBtn'),
        undoBtn: $('undoBtn'),
        deleteBtn: $('deleteBtn'),
        shareBtn: $('shareBtn'),
        exportBtn: $('exportBtn'),
        resetCameraBtn: $('resetCameraBtn'),
        clearBtn: $('clearBtn'),
    };

    const toast = createToast(ids.toast);
    const panel = createPanel(ids.creatorPanel, ids.panelToggle);

    const sliders = createSliders(ids.sliders, store, onSliderChange);

    const modeTabs = createModeTabs(ids.modeTabs, store, (mode) => {
        actions.onModeChange && actions.onModeChange(mode);
    });

    function reflectMode(mode) {
        modeTabs.reflectMode(mode);
        ids.creatorPanel.classList.toggle('hidden', mode !== 'creator');
        ids.plantInGardenBtn.classList.toggle('hidden', mode !== 'creator');
        if (ids.hint) ids.hint.textContent = mode === 'garden'
            ? '轻点空地放置 · 拖动旋转 · 双指缩放'
            : '拖动滑块雕琢专属植物 · 调好按「种入花园」';
    }

    // 初次回填 seedInput
    syncSeedInputFromState();

    // ---- 种子输入 ----
    // 防抖：用户停止输入后再解析回写 store，避免边打边触发
    const onSeedInput = debounce(() => {
        const raw = ids.seedInput.value.trim();
        if (!raw) return;
        let parsed;
        try {
            parsed = decodeState(raw);
        } catch (err) {
            toast.show('种子无法解析，已回退默认');
            syncSeedInputFromState();
            return;
        }
        store.replaceAll({ baseSeed: parsed.baseSeed, params: parsed.params });
        sliders.refreshFromStore();
        actions.onSeedChange && actions.onSeedChange(raw, 'manual');
    }, 350);
    ids.seedInput.addEventListener('input', onSeedInput);

    // 粘贴/回车立即解析
    ids.seedInput.addEventListener('paste', () => setTimeout(() => onSeedInput.flush(), 0));
    ids.seedInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); onSeedInput.flush(); }
    });

    ids.copySeed.addEventListener('click', async () => {
        const s = ids.seedInput.value;
        const ok = await copyToClipboard(s);
        toast.show(ok ? '种子已复制，可粘贴分享' : '复制失败，请手动选择');
    });

    // ---- 滑块变更 ----
    function onSliderChange() {
        syncSeedInputFromState();
        actions.onParamsLiveChange && actions.onParamsLiveChange();
    }

    // ---- 按钮绑定 ----
    ids.randomBtn.addEventListener('click', () => actions.onRandomSeed && actions.onRandomSeed());
    ids.generateBtn.addEventListener('click', () => actions.onGenerate && actions.onGenerate());
    ids.plantInGardenBtn?.addEventListener('click', () => actions.onPlantInGarden && actions.onPlantInGarden());
    ids.undoBtn.addEventListener('click', () => actions.onUndo && actions.onUndo());
    ids.deleteBtn.addEventListener('click', () => actions.onDelete && actions.onDelete());
    ids.shareBtn.addEventListener('click', () => actions.onShare && actions.onShare());
    ids.exportBtn.addEventListener('click', () => actions.onExport && actions.onExport());
    ids.resetCameraBtn.addEventListener('click', () => actions.onResetCamera && actions.onResetCamera());
    ids.clearBtn.addEventListener('click', () => actions.onClear && actions.onClear());

    // ---- 同步辅助 ----
    function syncSeedInputFromState() {
        const st = store.getState();
        const str = encodeState({ baseSeed: st.baseSeed, params: st.params });
        // 只在失焦或值真变时回写，避免打断用户输入
        if (document.activeElement !== ids.seedInput) {
            ids.seedInput.value = str;
        } else if (!ids.seedInput.value.startsWith('G1-')) {
            ids.seedInput.value = str;
        }
    }

    function setUndoEnabled(enabled) { ids.undoBtn.disabled = !enabled; }
    function setDeleteEnabled(enabled) { ids.deleteBtn.disabled = !enabled; }
    function setSeedText(text) {
        ids.seedInput.value = text;
        ids.seedInput.blur();
    }

    // 监听 store 变化以刷新 seedInput（模式变化/参数外部写入时）
    store.subscribe((state) => {
        syncSeedInputFromState();
        // 选中态影响删除按钮可用性
        if (ids.deleteBtn) ids.deleteBtn.disabled = !state.selectedId;
    });

    // 初始模式反映
    reflectMode(store.getState().mode);

    return {
        toast,
        panel,
        sliders,
        reflectMode,
        syncSeedInputFromState,
        setUndoEnabled,
        setDeleteEnabled,
        setSeedText,
    };
}