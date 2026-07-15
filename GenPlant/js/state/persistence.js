/**
 * 持久化：localStorage 花园 + URL hash 双向同步
 *
 * 两种分享锚点：
 * - URL hash `#s=G1-...` 单植物 seed（造物模式调出的当前植物）
 * - URL hash `#g=P-...` 花园快照（可选）
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

const _writeHashDebounced = debounce((entries) => {
    try {
        const url = new URL(window.location.href);
        for (const [k, v] of Object.entries(entries)) {
            if (v === undefined || v === '') {
                url.searchParams; // noop guard
                url.hash = url.hash; // noop
            }
            if (v === undefined || v === '') {
                // remove
                const cur = new URLSearchParams(url.hash.replace(/^#/, ''));
                cur.delete(k);
                url.hash = cur.toString();
            } else {
                const cur = new URLSearchParams(url.hash.replace(/^#/, ''));
                cur.set(k, v);
                url.hash = cur.toString();
            }
        }
        window.history.replaceState(null, '', url);
    } catch (err) {
        console.warn('writeHashDebounced failed:', err);
    }
}, 200);

function updateHash(entries) {
    _writeHashDebounced(entries);
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