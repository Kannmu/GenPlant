import { PLANT_PRESETS } from '../state/defaults.js';

export function createGenes(store, { onLiveChange, onCommit, onRefreshAdvanced } = {}) {
    const controls = {
        posture: bindRange('genePosture', 'genePostureValue', applyPosture),
        abundance: bindRange('geneAbundance', 'geneAbundanceValue', applyAbundance),
        rhythm: bindRange('geneRhythm', 'geneRhythmValue', applyRhythm),
        bloom: bindRange('geneBloom', 'geneBloomValue', applyBloom)
    };

    const presetButtons = [...document.querySelectorAll('#presetControls [data-preset]')];
    const paletteButtons = [...document.querySelectorAll('#paletteControls [data-palette]')];

    for (const button of presetButtons) {
        button.addEventListener('click', () => {
            const preset = PLANT_PRESETS[button.dataset.preset];
            if (!preset) return;
            store.patchParams(preset.params);
            presetButtons.forEach(item => item.classList.toggle('active', item === button));
            refreshFromStore();
            onRefreshAdvanced?.();
            onCommit?.('preset');
        });
    }

    for (const button of paletteButtons) {
        button.addEventListener('click', () => {
            const palette = Number(button.dataset.palette);
            if (!Number.isFinite(palette)) return;
            store.patchParams({ palette });
            paletteButtons.forEach(item => item.classList.toggle('active', item === button));
            onRefreshAdvanced?.();
            onCommit?.('palette');
        });
    }

    refreshFromStore();

    return { refreshFromStore };

    function bindRange(inputId, outputId, apply) {
        const input = document.getElementById(inputId);
        const output = document.getElementById(outputId);
        if (!input || !output) return null;
        input.addEventListener('input', () => {
            const value = Number(input.value) / 100;
            output.value = String(Math.round(value * 100));
            apply(value);
            presetButtons.forEach(item => item.classList.remove('active'));
            onRefreshAdvanced?.();
            onLiveChange?.(inputId);
        });
        input.addEventListener('change', () => onCommit?.(inputId));
        return { input, output };
    }

    function refreshFromStore() {
        const p = store.getState().params;
        setControl(controls.posture, clamp01((p.gravitropism + 0.1) / 1.0));
        setControl(controls.abundance, clamp01((p.leafiness * 0.7) + ((1 - p.pruning) * 0.3)));
        setControl(controls.rhythm, clamp01(p.curvinessAmp / 0.38));
        setControl(controls.bloom, clamp01(p.bloom));
        paletteButtons.forEach(button => {
            button.classList.toggle('active', Number(button.dataset.palette) === Math.round(p.palette));
        });
    }

    function applyPosture(value) {
        store.patchParams({
            gravitropism: lerp(-0.1, 0.9, value),
            splitAngleMin: lerp(0.9, 0.18, value),
            splitAngleMax: lerp(1.25, 0.62, value),
            lengthDecay: lerp(0.66, 0.79, value)
        });
    }

    function applyAbundance(value) {
        store.patchParams({
            pruning: lerp(0.72, 0.08, value),
            levels: Math.round(lerp(3, 6, value)),
            branchesPerSplitMin: value > 0.74 ? 3 : 2,
            branchesPerSplitMax: Math.round(lerp(2, 4, value)),
            leafiness: value
        });
    }

    function applyRhythm(value) {
        store.patchParams({
            curvinessAmp: lerp(0.025, 0.36, value),
            curvinessFreq: lerp(0.7, 2.8, value),
            rotationMin: lerp(0.2, 1.1, value),
            rotationMax: lerp(1.15, 3.08, value)
        });
    }

    function applyBloom(value) {
        store.patchParams({ bloom: value });
    }
}

function setControl(control, value) {
    if (!control) return;
    const normalized = Math.round(clamp01(value) * 100);
    control.input.value = String(normalized);
    control.output.value = String(normalized);
}

function lerp(a, b, t) {
    return a + (b - a) * clamp01(t);
}

function clamp01(value) {
    return Math.min(1, Math.max(0, Number(value) || 0));
}
