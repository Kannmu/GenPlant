/**
 * 全局状态仓库：单一数据源
 * 不直接依赖 three.js（保持纯逻辑，便于序列化/SSR/调试）
 *
 * 状态结构：
 * {
 *   mode: 'garden' | 'creator',
 *   baseSeed: number,            // mulberry32 主种子 (1..SEED.MAX_VALUE)
 *   params: { ...可控混沌参数 }, // 见 defaults.js
 *   selectedId: string | null,  // 花园模式选中植物 id
 *   garden: PlantDescriptor[],   // 见 GardenManager，store 仅镜像副本用于持久化
 *   ui: { panelOpen: boolean, ... }
 * }
 *
 * 变更通过 set() 走，触发订阅者。store 不做深度不可变化，调用方应传入新引用。
 */

import { DEFAULT_PARAMS, DEFAULT_STATE } from '../state/defaults.js';
import { clamp } from '../util/dom.js';
import { GENERATOR_CONFIG } from '../config/constants.js';

const EVENT_CHANGE = 'change';

export function createStore(initial = {}) {
    const params = { ...DEFAULT_PARAMS };
    if (initial && initial.params && typeof initial.params === 'object') {
        Object.assign(params, sanitizeParams(initial.params));
    }
    const state = {
        mode: 'creator',
        baseSeed: DEFAULT_STATE.baseSeed,
        params,
        selectedId: null,
        garden: [],
        ui: { panelOpen: true },
    };
    // 仅应用显式且合法的覆盖键
    if (initial.mode === 'creator' || initial.mode === 'garden') state.mode = initial.mode;
    if (initial.baseSeed !== undefined && !isNaN(Number(initial.baseSeed))) {
        state.baseSeed = Number(initial.baseSeed);
    }
    if (Array.isArray(initial.garden)) state.garden = initial.garden;

    const listeners = new Set();

    function getState() {
        return state;
    }

    function get(revisionKey) {
        return state[revisionKey];
    }

    /**
     * 局部更新某一项（浅合并），触发变更通知
     */
    function set(patch) {
        let changed = false;
        for (const key of Object.keys(patch)) {
            const next = patch[key];
            if (!Object.is(next, state[key])) {
                state[key] = next;
                changed = true;
            }
        }
        if (changed) notify();
        return state;
    }

    /**
     * 单独更新 params 中某些字段（保持其它字段不变）
     */
    function patchParams(paramPatch) {
        state.params = { ...state.params, ...paramPatch };
        notify();
        return state;
    }

    function setBaseSeed(seed) {
        let num = Number(seed);
        if (isNaN(num) || num < GENERATOR_CONFIG.SEED.MIN_VALUE) {
            num = GENERATOR_CONFIG.SEED.MIN_VALUE;
        } else if (num > GENERATOR_CONFIG.SEED.MAX_VALUE) {
            num = GENERATOR_CONFIG.SEED.MAX_VALUE;
        }
        num = Math.floor(clamp(num, GENERATOR_CONFIG.SEED.MIN_VALUE, GENERATOR_CONFIG.SEED.MAX_VALUE));
        state.baseSeed = num;
        notify();
        return state;
    }

    function setMode(mode) {
        if (state.mode !== mode) {
            state.mode = mode;
            notify();
        }
        return state;
    }

    function setSelected(id) {
        if (state.selectedId !== id) {
            state.selectedId = id;
            notify();
        }
    }

    function setGarden(garden) {
        state.garden = Array.isArray(garden) ? garden : [];
        notify();
    }

    function subscribe(handler) {
        if (typeof handler !== 'function') return () => {};
        listeners.add(handler);
        return () => listeners.delete(handler);
    }

    function notify() {
        for (const handler of [...listeners]) {
            try {
                handler(state);
            } catch (err) {
                console.error('store subscriber threw:', err);
            }
        }
    }

    /**
     * 用一套给定参数与种子整体替换（用于加载分享链接/默认状态）
     */
    function replaceAll({ baseSeed, params, mode, garden }) {
        let changed = false;
        if (baseSeed !== undefined) {
            state.baseSeed = Number(baseSeed) || state.baseSeed;
            changed = true;
        }
        if (params && typeof params === 'object') {
            state.params = { ...state.params, ...sanitizeParams(params) };
            changed = true;
        }
        if (mode === 'creator' || mode === 'garden') {
            state.mode = mode;
            changed = true;
        }
        if (Array.isArray(garden)) {
            state.garden = garden;
            changed = true;
        }
        if (changed) notify();
        return state;
    }

    function sanitizeParams(params) {
        const out = { ...DEFAULT_PARAMS };
        for (const key of Object.keys(DEFAULT_PARAMS)) {
            if (key in params && typeof params[key] === 'number' && isFinite(params[key])) {
                out[key] = params[key];
            }
        }
        return out;
    }

    return {
        getState,
        get,
        set,
        patchParams,
        setBaseSeed,
        setMode,
        setSelected,
        setGarden,
        replaceAll,
        subscribe,
    };
}