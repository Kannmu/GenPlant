import test from 'node:test';
import assert from 'node:assert/strict';

import { encodeState, decodeState, encodeGarden, decodeGarden } from '../GenPlant/js/core/seed.js';
import { DEFAULT_PARAMS, SLIDERS } from '../GenPlant/js/state/defaults.js';
import { createStore } from '../GenPlant/js/core/store.js';
import { describePlant } from '../GenPlant/js/core/naming.js';
import { createTemplateLibrary } from '../GenPlant/js/state/templates.js';
import { generate } from '../GenPlant/js/generator/index.js';
import { createParameters } from '../GenPlant/js/generator/parameters.js';
import { createStructure } from '../GenPlant/js/generator/structure.js';
import { getPlantingRadius, isWithinPlantingArea } from '../GenPlant/js/garden/GardenManager.js';
import { createLivePreviewScheduler } from '../GenPlant/js/util/previewScheduler.js';

const LEGACY_G1 = 'G1-0001-0gc0uy9-00a5-00dw-00dw-008c-006d-00dc-00cr-00b4-00ci-003j-00jg-00m7-0000-0099-00p9-00k9-00rr';
const LEGACY_GARDEN = `P-${LEGACY_G1}.0q8i.0ouh.01t5`;

test('plant seeds round-trip every editable field', () => {
    const params = {
        ...DEFAULT_PARAMS,
        gravitropism: -0.27,
        levels: 6,
        leafiness: 0.91,
        bloom: 0.73,
        palette: 4
    };
    const encoded = encodeState({ baseSeed: 987654321, params });
    const decoded = decodeState(encoded);

    assert.match(encoded, /^G2-/);
    assert.ok(encoded.length <= 40);
    assert.equal(decoded.baseSeed, 987654321);
    for (const meta of SLIDERS) {
        assert.ok(Math.abs(decoded.params[meta.key] - params[meta.key]) <= Math.max(meta.step, 0.006));
    }
});

test('legacy G1 seeds and P gardens remain readable', () => {
    const decoded = decodeState(LEGACY_G1);
    assert.equal(decoded.baseSeed, 987654321);
    assert.ok(Math.abs(decoded.params.gravitropism - (-0.27)) < 0.01);
    assert.equal(Math.round(decoded.params.levels), 6);

    const garden = decodeGarden(LEGACY_GARDEN);
    assert.equal(garden.length, 1);
    assert.equal(garden[0].seed, LEGACY_G1);
    assert.equal(garden[0].x, 12.34);
    assert.equal(garden[0].z, -5.67);
    assert.equal(garden[0].rotationY, 2.345);
});

test('P2 gardens deduplicate repeated plant states and round-trip transforms', () => {
    const seed = encodeState({ baseSeed: 987654321, params: DEFAULT_PARAMS });
    const source = Array.from({ length: 60 }, (_, index) => ({
        seed,
        x: Number((Math.cos(index) * 30).toFixed(2)),
        z: Number((Math.sin(index) * 30).toFixed(2)),
        rotationY: Number((index * 0.1).toFixed(3))
    }));
    const encoded = encodeGarden(source);
    const decoded = decodeGarden(encoded);

    assert.match(encoded, /^P2-/);
    assert.ok(encoded.length < 600);
    assert.equal(decoded.length, source.length);
    for (let i = 0; i < source.length; i++) {
        assert.equal(decoded[i].seed, seed);
        assert.equal(decoded[i].x, source[i].x);
        assert.equal(decoded[i].z, source[i].z);
        assert.ok(Math.abs(decoded[i].rotationY - source[i].rotationY) <= 0.001);
    }
});

test('legacy numeric seeds keep the default phenotype', () => {
    const decoded = decodeState('20250715');
    assert.equal(decoded.baseSeed, 20250715);
    assert.deepEqual(decoded.params, DEFAULT_PARAMS);
});

test('store clamps invalid base seeds and preserves finite parameters', () => {
    const store = createStore({ baseSeed: -99, params: { bloom: 0.8, leafiness: Number.NaN } });
    store.setBaseSeed(Number.POSITIVE_INFINITY);
    assert.equal(store.getState().baseSeed, 1);
    assert.equal(store.getState().params.bloom, 0.8);
    assert.equal(store.getState().params.leafiness, DEFAULT_PARAMS.leafiness);
});

test('plant naming is deterministic and reacts to phenotype', () => {
    const first = describePlant(42, DEFAULT_PARAMS);
    const second = describePlant(42, DEFAULT_PARAMS);
    const flowering = describePlant(42, { ...DEFAULT_PARAMS, bloom: 0.95 });

    assert.deepEqual(first, second);
    assert.equal(first.name, flowering.name);
    assert.notEqual(first.traits, flowering.traits);
});

test('template library saves, updates, selects and imports compact descriptors', () => {
    const values = new Map();
    globalThis.localStorage = {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };

    const library = createTemplateLibrary();
    const first = library.save({ baseSeed: 123, params: DEFAULT_PARAMS });
    library.save({ baseSeed: 123, params: { ...DEFAULT_PARAMS, bloom: 0.91 } }, first.id);
    assert.equal(library.list().length, 1);
    assert.equal(library.getActive().id, first.id);
    assert.ok(library.resolve(first.id).params.bloom > 0.9);

    const importedSeed = encodeState({ baseSeed: 456, params: { ...DEFAULT_PARAMS, palette: 3 } });
    library.importSeeds([{ seed: importedSeed }]);
    assert.equal(library.list().length, 2);
    assert.equal(library.remove(first.id), true);
    assert.equal(library.list().length, 1);
});

test('generated plants merge all branches into one draw mesh', () => {
    const plant = generate(2026, DEFAULT_PARAMS, { previewQuality: true });
    let branchMeshes = 0;
    let branchTriangles = 0;
    plant.traverse(child => {
        if (child.name === 'branches' && child.isMesh) {
            branchMeshes++;
            branchTriangles += child.geometry.index.count / 3;
        }
    });
    assert.equal(branchMeshes, 1);
    assert.ok(branchTriangles > 0);
});

test('draft preview uses substantially fewer branch triangles', () => {
    const full = generate(2026, DEFAULT_PARAMS, { previewQuality: false });
    const draft = generate(2026, DEFAULT_PARAMS, { previewQuality: true });
    const branchTriangles = plant => {
        const mesh = plant.children.find(child => child.name === 'branches');
        return mesh.geometry.index.count / 3;
    };
    assert.ok(branchTriangles(draft) < branchTriangles(full) * 0.45);
});

test('structure node budget is a hard upper bound', () => {
    const params = {
        ...DEFAULT_PARAMS,
        levels: 7,
        branchesPerSplitMin: 5,
        branchesPerSplitMax: 5,
        pruning: 0,
        lengthDecay: 0.92
    };
    const root = createStructure(createParameters(2026, params));
    let nodes = 0;
    (function count(node) {
        nodes++;
        for (const child of node.children || []) count(child);
    })(root);
    assert.ok(nodes <= 720);
});

test('planting boundary matches the visible circular dais', () => {
    const radius = getPlantingRadius();
    assert.equal(isWithinPlantingArea(radius, 0), true);
    assert.equal(isWithinPlantingArea(0, -radius), true);
    assert.equal(isWithinPlantingArea(radius + 0.01, 0), false);
    assert.equal(isWithinPlantingArea(radius, radius), false);
    assert.equal(isWithinPlantingArea(Number.NaN, 0), false);
});

test('live preview scheduler updates during continuous input instead of waiting for quiet', () => {
    let clock = 0;
    let calls = 0;
    const timers = [];
    const frames = [];
    const runtime = {
        now: () => clock,
        setTimeout(fn, delay) {
            const token = { fn, delay, cancelled: false };
            timers.push(token);
            return token;
        },
        clearTimeout(token) { token.cancelled = true; },
        requestAnimationFrame(fn) {
            const token = { fn, cancelled: false };
            frames.push(token);
            return token;
        },
        cancelAnimationFrame(token) { token.cancelled = true; }
    };
    const scheduler = createLivePreviewScheduler(() => calls++, 48, runtime);

    scheduler.schedule();
    const timerA = timers.shift();
    assert.equal(timerA.delay, 0);
    timerA.fn();
    frames.shift().fn();
    assert.equal(calls, 1);

    clock = 10;
    scheduler.schedule();
    scheduler.schedule();
    const timerB = timers.shift();
    assert.equal(timerB.delay, 38);
    clock = 48;
    timerB.fn();
    frames.shift().fn();
    assert.equal(calls, 2);
});
