import test from 'node:test';
import assert from 'node:assert/strict';

import { encodeState, decodeState } from '../GenPlant/js/core/seed.js';
import { DEFAULT_PARAMS, SLIDERS } from '../GenPlant/js/state/defaults.js';
import { createStore } from '../GenPlant/js/core/store.js';
import { describePlant } from '../GenPlant/js/core/naming.js';
import { createTemplateLibrary } from '../GenPlant/js/state/templates.js';
import { generate } from '../GenPlant/js/generator/index.js';

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

    assert.equal(decoded.baseSeed, 987654321);
    for (const meta of SLIDERS) {
        assert.ok(Math.abs(decoded.params[meta.key] - params[meta.key]) <= Math.max(meta.step, 0.006));
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
    plant.traverse(child => {
        if (child.name === 'branches' && child.isMesh) branchMeshes++;
    });
    assert.equal(branchMeshes, 1);
});
