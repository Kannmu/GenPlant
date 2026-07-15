/**
 * 持久化：localStorage 花园 + URL hash 双向同步
 *
 * 两种分享锚点：
 * - URL hash `#s=G2-...` 单植物 seed（兼容旧 G1）
 * - URL hash `#g=P2-...` 花园快照（兼容旧 P）
 * - localStorage 持续保存花园与最近植物
 */

import { encodeState, decodeState, encodeGarden, decodeGarden } from '../core/seed.js';
import { storage, debounce } from '../util/dom.js';

const LS_KEY_GARDEN = 'genplant:garden';
const LS_KEY_PLANT = 'genplant:plant';

/**
 * 从 URL hash 读取初始种子与花园
 * @returns {{plantSeed?:string, garden?:Array}}
 */
export function readFromURL() {
    const result = {};
    try {
        const hash = window.location.hash.replace(/^#/, '');
        const params = new URLSearchParams(hash);
        if (params.has('s')) result.plantSeed = params.get('s');
        if (params.has('g')) result.garden = decodeGarden(params.get('g'));
    } catch (err) {
        console.warn('readFromURL failed:', err);
    }
    return result;
}

export function writePlantSeedToURL(seedStr) {
    updateHash({ s: seedStr });
}

export function writeGardenToURL(garden) {
    const encoded = encodeGarden(garden);
    updateHash({ g: encoded || undefined });
}

let pendingHashEntries = {};

const _writeHashDebounced = debounce(() => {
    try {
        const url = new URL(window.location.href);
        const entries = pendingHashEntries;
        pendingHashEntries = {};
        const current = new URLSearchParams(url.hash.replace(/^#/, ''));
        for (const [k, v] of Object.entries(entries)) {
            if (v === undefined || v === '') {
                current.delete(k);
            } else {
                current.set(k, v);
            }
        }
        url.hash = current.toString();
        window.history.replaceState(null, '', url);
    } catch (err) {
        console.warn('writeHashDebounced failed:', err);
    }
}, 200);

function updateHash(entries) {
    pendingHashEntries = { ...pendingHashEntries, ...entries };
    _writeHashDebounced();
}

export function saveGarden(garden) {
    storage.set(LS_KEY_GARDEN, garden);
}

export function loadGarden() {
    return storage.get(LS_KEY_GARDEN, []);
}

export function savePlant(stateObj) {
    storage.set(LS_KEY_PLANT, stateObj);
}

export function loadPlant() {
    return storage.get(LS_KEY_PLANT, null);
}
