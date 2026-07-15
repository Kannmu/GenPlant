/**
 * 种子 / 状态编解码
 *
 * 一个可分享的植物状态被编码为形如 "G1-<base36 tokens 以 '-' 连接>" 的紧凑字符串，
 * 同时作为 seedInput 的值与 URL hash 使用。
 *
 * 编码字段顺序（固定，不可重排 —— 否则破坏已分享链接兼容）：
 *   [version, baseSeed, gravitropism, phototropismX, phototropismZ, pruning,
 *    splitAngleMin, splitAngleMax, lengthDecay, curvinessFreq, curvinessAmp,
 *    rotationMin, rotationMax, levels, branchesPerSplitMin, branchesPerSplitMax]
 *
 * 每个浮点参数按其滑块 [min, max] 量化到一个整数刻度后转 base36（固定位数），
 * 这样编码前后的往返损失在滑块步进以内。
 *
 * 旧版纯整数种子兼容：纯数字字符串被视为 {baseSeed:int, params:DEFAULT_PARAMS}。
 */

import { SEED_SCHEMA, GENERATOR_CONFIG } from '../config/constants.js';
import { DEFAULT_PARAMS, SLIDERS } from '../state/defaults.js';
import { clamp } from '../util/dom.js';

// 字段量化刻度数（越大精度越高但码越长）。浮点字段统一用 1000 档。
const QUANT = 1000;

// base36 固定宽度：每字段最多 4 位 base36 可表示 36^4 ≈ 1.67M 档与 1e10 的种子
// 种子本身可达 1e10，需要 base36 宽度 7 位（36^7≈7.8e10）。
const FIELD_CHARS = 4;
const SEED_CHARS = 7;

function pad36(num, width) {
    let s = num.toString(36);
    while (s.length < width) s = '0' + s;
    // 防止异常超长（理论上 clamp 后不会）
    if (s.length > width) s = s.slice(s.length - width);
    return s;
}

function clampParam(value, meta) {
    return clamp(Number(value), meta.min, meta.max);
}

/**
 * 将单植物状态编码为字符串
 * @param {{baseSeed:number, params:object}} state
 * @returns {string} "G1-..."
 */
export function encodeState({ baseSeed, params }) {
    const seed = Math.floor(clamp(Number(baseSeed) || GENERATOR_CONFIG.SEED.MIN_VALUE,
        GENERATOR_CONFIG.SEED.MIN_VALUE, GENERATOR_CONFIG.SEED.MAX_VALUE));
    const parts = [pad36(SEED_SCHEMA.VERSION, FIELD_CHARS), pad36(seed, SEED_CHARS)];
    for (const meta of SLIDERS) {
        const v = clampParam(params?.[meta.key], meta);
        const scaled = Math.round(((v - meta.min) / (meta.max - meta.min)) * (QUANT - 1));
        parts.push(pad36(scaled, FIELD_CHARS));
    }
    return SEED_SCHEMA.PREFIX + '-' + parts.join('-');
}

/**
 * 将字符串解码为状态。兼容旧版纯整数种子。
 * 任一字段缺失/越界/解析失败均回退到默认，绝不抛出。
 * @param {string} str
 * @returns {{baseSeed:number, params:object}}
 */
export function decodeState(str) {
    if (str == null) return { baseSeed: DEFAULT_PARAMS && (randomizeBaseSeed()), params: { ...DEFAULT_PARAMS } };

    const trimmed = String(str).trim();

    // 旧版纯整数种子
    if (/^-?\d+$/.test(trimmed)) {
        const num = Number(trimmed);
        return {
            baseSeed: clampSeed(num),
            params: { ...DEFAULT_PARAMS }
        };
    }

    // 旧版带小数/科学记数法的种子数字
    if (!trimmed.startsWith(SEED_SCHEMA.PREFIX)) {
        const num = Number(trimmed);
        if (!isNaN(num) && isFinite(num)) {
            return { baseSeed: clampSeed(num), params: { ...DEFAULT_PARAMS } };
        }
        return { baseSeed: randomizeBaseSeed(), params: { ...DEFAULT_PARAMS } };
    }

    const body = trimmed.slice(SEED_SCHEMA.PREFIX.length + 1); // 去掉 "G1-"
    const tokens = body.split('-');
    // tokens[0] = version, tokens[1] = baseSeed, 之后顺序与 SLIDERS 对应
    const version = parseInt36(tokens[0]) ?? SEED_SCHEMA.VERSION;
    const baseSeed = clampSeed(parseInt36(tokens[1]) ?? randomizeBaseSeed());

    const params = { ...DEFAULT_PARAMS };
    for (let i = 0; i < SLIDERS.length; i++) {
        const meta = SLIDERS[i];
        const tok = tokens[i + 2];
        if (tok == null) continue;
        const scaled = parseInt36(tok);
        if (scaled == null || scaled < 0) continue;
        const value = meta.min + (scaled / (QUANT - 1)) * (meta.max - meta.min);
        params[meta.key] = clamp(value, meta.min, meta.max);
    }
    void version; // 预留：未来按 version 迁移
    return { baseSeed, params };
}

function parseInt36(s) {
    if (s == null || s === '') return null;
    const n = parseInt(s, 36);
    return isNaN(n) ? null : n;
}

function clampSeed(num) {
    return Math.floor(clamp(Number(num) || GENERATOR_CONFIG.SEED.MIN_VALUE,
        GENERATOR_CONFIG.SEED.MIN_VALUE, GENERATOR_CONFIG.SEED.MAX_VALUE));
}

function randomizeBaseSeed() {
    const { MIN_VALUE, MAX_VALUE } = GENERATOR_CONFIG.SEED;
    return Math.floor(Math.random() * (MAX_VALUE - MIN_VALUE + 1)) + MIN_VALUE;
}

/**
 * 将一个花园（多植物列表）编码为字符串。
 * 每项为 { seed:str, x:number, z:number, rotationY:number }。
 * @param {Array<{seed:string,x:number,z:number,rotationY:number}>} garden
 * @returns {string} "P-..."
 */
export function encodeGarden(garden) {
    if (!Array.isArray(garden) || garden.length === 0) return '';
    const items = garden.map(p => {
        const xs = (Math.round(p.x * 100) + 32768).toString(36).padStart(4, '0');
        const zs = (Math.round(p.z * 100) + 32768).toString(36).padStart(4, '0');
        const rs = Math.round(((p.rotationY % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) * 1000).toString(36).padStart(4, '0');
        return [p.seed, xs, zs, rs].join('.');
    });
    return SEED_SCHEMA.GARDEN_PREFIX + '-' + items.join('|');
}

/**
 * 解码花园字符串
 * @param {string} str
 * @returns {Array}
 */
export function decodeGarden(str) {
    if (!str || typeof str !== 'string') return [];
    const trimmed = str.trim();
    if (!trimmed.startsWith(SEED_SCHEMA.GARDEN_PREFIX + '-')) return [];
    const body = trimmed.slice(SEED_SCHEMA.GARDEN_PREFIX.length + 1);
    return body.split('|').map(item => {
        const parts = item.split('.');
        if (parts.length < 4) return null;
        const seed = parts.slice(0, parts.length - 3).join('.'); // 种子本身含 '.'
        const xs = parseInt(parts[parts.length - 3], 36);
        const zs = parseInt(parts[parts.length - 2], 36);
        const rs = parseInt(parts[parts.length - 1], 36);
        if (seed == null || isNaN(xs) || isNaN(zs) || isNaN(rs)) return null;
        return {
            seed,
            x: (xs - 32768) / 100,
            z: (zs - 32768) / 100,
            rotationY: (rs / 1000)
        };
    }).filter(Boolean);
}