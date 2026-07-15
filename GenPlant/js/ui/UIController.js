import { createSliders } from './Sliders.js';
import { createModeTabs } from './ModeTabs.js';
import { createPanel } from './Panel.js';
import { createToast } from './Toast.js';
import { createGenes } from './Genes.js';
import { encodeState, decodeState } from '../core/seed.js';
import { describePlant } from '../core/naming.js';
import { debounce, copyToClipboard } from '../util/dom.js';
import { createElement, Pencil, Trash2 } from 'lucide';

export function createUIController(store, actions = {}) {
    const $ = (id) => document.getElementById(id);
    const ids = {
        seedInput: $('seedInput'),
        seedForm: $('seedForm'),
        copySeed: $('copySeedBtn'),
        seedBtn: $('seedBtn'),
        identityBtn: $('identityBtn'),
        closeSeedBtn: $('closeSeedBtn'),
        seedPanel: $('seedPanel'),
        modeTabs: $('modeTabs'),
        creatorPanel: $('creatorPanel'),
        panelToggle: $('panelToggle'),
        libraryPanel: $('libraryPanel'),
        libraryToggle: $('libraryToggle'),
        templateList: $('templateList'),
        emptyLibrary: $('emptyLibrary'),
        templateCount: $('templateCount'),
        sliders: $('sliders'),
        toast: $('toast'),
        hint: $('hint'),
        randomBtn: $('randomBtn'),
        mutateBtn: $('mutateBtn'),
        generateBtn: $('generateBtn'),
        saveTemplateBtn: $('saveTemplateBtn'),
        undoBtn: $('undoBtn'),
        deleteBtn: $('deleteBtn'),
        shareBtn: $('shareBtn'),
        exportBtn: $('exportBtn'),
        resetCameraBtn: $('resetCameraBtn'),
        clearBtn: $('clearBtn'),
        moreBtn: $('moreBtn'),
        moreMenu: $('moreMenu'),
        moodBtn: $('moodBtn'),
        windBtn: $('windBtn'),
        plantName: $('plantName'),
        plantNameTop: $('plantNameTop'),
        plantTraits: $('plantTraits'),
        specimenIndex: $('specimenIndex'),
        gardenCount: $('gardenCount')
    };

    const toast = createToast(ids.toast);
    const panel = createPanel(ids.creatorPanel, ids.panelToggle, { label: '基因面板' });
    const libraryPanel = createPanel(ids.libraryPanel, ids.libraryToggle, { label: '植物库' });
    const sliders = createSliders(ids.sliders, store, onParamsLiveChange, onParamsCommit);
    const genes = createGenes(store, {
        onLiveChange: onParamsLiveChange,
        onCommit: onParamsCommit,
        onRefreshAdvanced: () => sliders.refreshFromStore()
    });
    const modeTabs = createModeTabs(ids.modeTabs, store, (mode) => {
        actions.onModeChange?.(mode);
    });

    let activeTemplate = null;
    let editingTemplateId = null;

    if (window.matchMedia('(max-width: 820px)').matches) {
        panel.setCollapsed(true);
        libraryPanel.setCollapsed(true);
    }
    syncSeedInputFromState();
    updateIdentity();

    function reflectMode(mode) {
        modeTabs.reflectMode(mode);
        setModeVisibility(ids.creatorPanel, mode === 'creator');
        setModeVisibility(ids.libraryPanel, mode === 'garden');
        document.querySelectorAll('.creator-only').forEach(el => setModeVisibility(el, mode === 'creator'));
        document.querySelectorAll('.garden-only').forEach(el => setModeVisibility(el, mode === 'garden'));
        closeTransientPanels();
        updateIdentity();
    }

    function setModeVisibility(element, visible) {
        element.classList.toggle('hidden', !visible);
        element.hidden = !visible;
        element.inert = !visible;
        element.setAttribute('aria-hidden', String(!visible));
    }

    const onSeedInput = debounce(() => {
        const raw = ids.seedInput.value.trim();
        if (!raw) return;
        const parsed = decodeState(raw);
        store.replaceAll({ baseSeed: parsed.baseSeed, params: parsed.params });
        sliders.refreshFromStore();
        genes.refreshFromStore();
        actions.onSeedChange?.(raw, 'manual');
    }, 320);

    ids.seedInput.addEventListener('input', onSeedInput);
    ids.seedInput.addEventListener('paste', () => setTimeout(() => onSeedInput.flush(), 0));
    ids.seedInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            onSeedInput.flush();
        }
    });

    ids.copySeed.addEventListener('click', async () => {
        const ok = await copyToClipboard(ids.seedInput.value);
        toast.show(ok ? '种子已复制' : '复制失败，请手动选择');
    });

    ids.seedBtn.addEventListener('click', toggleSeedPanel);
    ids.identityBtn.addEventListener('click', toggleSeedPanel);
    ids.closeSeedBtn.addEventListener('click', () => ids.seedPanel.classList.add('hidden'));
    ids.moreBtn.addEventListener('click', () => {
        const willOpen = ids.moreMenu.classList.contains('hidden');
        ids.moreMenu.classList.toggle('hidden', !willOpen);
        ids.moreBtn.setAttribute('aria-expanded', String(willOpen));
        if (willOpen) ids.seedPanel.classList.add('hidden');
    });

    ids.randomBtn.addEventListener('click', () => actions.onRandomSeed?.());
    ids.mutateBtn.addEventListener('click', () => actions.onMutate?.());
    ids.generateBtn.addEventListener('click', () => actions.onGenerate?.());
    ids.saveTemplateBtn.addEventListener('click', () => actions.onSaveTemplate?.());
    ids.undoBtn.addEventListener('click', () => actions.onUndo?.());
    ids.deleteBtn.addEventListener('click', () => actions.onDelete?.());
    ids.shareBtn.addEventListener('click', () => actions.onShare?.());
    ids.exportBtn.addEventListener('click', () => { closeTransientPanels(); actions.onExport?.(); });
    ids.resetCameraBtn.addEventListener('click', () => actions.onResetCamera?.());
    ids.clearBtn.addEventListener('click', () => { closeTransientPanels(); actions.onClear?.(); });
    ids.moodBtn.addEventListener('click', () => {
        const state = actions.onMoodChange?.();
        if (state) setMoodState(state);
    });
    ids.windBtn.addEventListener('click', () => {
        const state = actions.onWindChange?.();
        if (state) setWindState(state);
    });

    function onParamsLiveChange() {
        syncSeedInputFromState();
        updateIdentity();
        actions.onParamsLiveChange?.();
    }

    function onParamsCommit(source) {
        actions.onParamsCommit?.(source);
    }

    function toggleSeedPanel() {
        const willOpen = ids.seedPanel.classList.contains('hidden');
        ids.seedPanel.classList.toggle('hidden', !willOpen);
        ids.moreMenu.classList.add('hidden');
        ids.moreBtn.setAttribute('aria-expanded', 'false');
        if (willOpen) ids.seedInput.select();
    }

    function closeTransientPanels() {
        ids.seedPanel.classList.add('hidden');
        ids.moreMenu.classList.add('hidden');
        ids.moreBtn.setAttribute('aria-expanded', 'false');
    }

    function syncSeedInputFromState() {
        const st = store.getState();
        const str = encodeState({ baseSeed: st.baseSeed, params: st.params });
        if (document.activeElement !== ids.seedInput || !ids.seedInput.value.startsWith('G1-')) {
            ids.seedInput.value = str;
        }
    }

    function updateIdentity() {
        const st = store.getState();
        const descriptor = st.mode === 'garden' && activeTemplate
            ? activeTemplate
            : describePlant(st.baseSeed, st.params);
        ids.plantName.textContent = descriptor.name;
        ids.plantNameTop.textContent = descriptor.name;
        ids.plantTraits.textContent = descriptor.traits;
        ids.specimenIndex.textContent = descriptor.specimen || `TEMPLATE ${String(descriptor.id || '').slice(-3).toUpperCase()}`;
        document.title = `${descriptor.name} · GenPlant`;
    }

    function setGardenCount(count) {
        ids.gardenCount.textContent = count > 0 ? `花园中有 ${count} 株生命` : '花园尚未种植';
    }

    function setMoodState({ key, label }) {
        document.body.dataset.mood = key;
        ids.moodBtn.dataset.tooltip = `光线：${label}`;
        ids.moodBtn.setAttribute('aria-label', `切换光线，当前${label}`);
    }

    function setWindState({ label }) {
        ids.windBtn.dataset.tooltip = `风力：${label}`;
        ids.windBtn.setAttribute('aria-label', `切换风力，当前${label}`);
    }

    function setUndoEnabled(enabled) { ids.undoBtn.disabled = !enabled; }
    function setDeleteEnabled(enabled) { ids.deleteBtn.disabled = !enabled; }

    function setGardenPlaceEnabled(enabled) { ids.generateBtn.disabled = !enabled; }

    function setActiveTemplate(template) {
        activeTemplate = template || null;
        setGardenPlaceEnabled(!!activeTemplate);
        updateIdentity();
    }

    function setEditingTemplate(id) {
        editingTemplateId = id || null;
        const label = ids.saveTemplateBtn.querySelector('span');
        if (label) label.textContent = editingTemplateId ? '更新模板' : '保存模板';
    }

    function renderTemplates(templates, activeId) {
        ids.templateList.replaceChildren();
        ids.templateCount.textContent = String(templates.length);
        ids.emptyLibrary.classList.toggle('hidden', templates.length > 0);
        ids.templateList.classList.toggle('hidden', templates.length === 0);

        for (const template of templates) {
            const item = document.createElement('div');
            item.className = 'template-item';
            item.classList.toggle('active', template.id === activeId);

            const selectButton = document.createElement('button');
            selectButton.type = 'button';
            selectButton.className = 'template-select';
            selectButton.setAttribute('aria-label', `选择模板 ${template.name}`);

            const swatch = document.createElement('span');
            swatch.className = `template-swatch ${template.palette < 0 ? 'palette-auto' : `palette-${template.palette}`}`;
            const copy = document.createElement('span');
            copy.className = 'template-copy';
            const name = document.createElement('strong');
            name.textContent = template.name;
            const traits = document.createElement('small');
            traits.textContent = template.traits;
            copy.append(name, traits);
            selectButton.append(swatch, copy);
            selectButton.addEventListener('click', () => actions.onSelectTemplate?.(template.id));

            const actionGroup = document.createElement('div');
            actionGroup.className = 'template-actions';
            actionGroup.append(
                makeTemplateAction(`编辑 ${template.name}`, Pencil, () => actions.onEditTemplate?.(template.id)),
                makeTemplateAction(`删除 ${template.name}`, Trash2, () => actions.onDeleteTemplate?.(template.id))
            );
            item.append(selectButton, actionGroup);
            ids.templateList.appendChild(item);
        }
    }

    function makeTemplateAction(label, icon, handler) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'icon-button';
        button.setAttribute('aria-label', label);
        button.dataset.tooltip = label;
        button.appendChild(createElement(icon, { 'aria-hidden': 'true' }));
        button.addEventListener('click', handler);
        return button;
    }

    store.subscribe((state) => {
        syncSeedInputFromState();
        updateIdentity();
        sliders.refreshFromStore();
        genes.refreshFromStore();
        ids.deleteBtn.disabled = !state.selectedId;
    });

    reflectMode(store.getState().mode);

    return {
        toast,
        panel,
        libraryPanel,
        sliders,
        genes,
        reflectMode,
        syncSeedInputFromState,
        setUndoEnabled,
        setDeleteEnabled,
        setGardenPlaceEnabled,
        setGardenCount,
        setActiveTemplate,
        setEditingTemplate,
        renderTemplates,
        setMoodState,
        setWindState,
        closeTransientPanels
    };
}
