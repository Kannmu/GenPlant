/**
 * 默认值、滑块元数据、调色板
 *
 * DEFAULT_PARAMS 是「造物模式」可调整的混沌参数键值映射。
 * 这些 key 与 seed.js 解码顺序一一对应——改变顺序会破坏已分享种子的兼容性，
 * 新增字段必须追加到末尾并保持向后兼容。
 *
 * 每个 SLIDERS 条目定义 { key, label, min, max, step, default }，
 * UIController 据此生成滑块并双向绑定到 store.params。
 * min/max 既是滑块边界，也是 seed.js 编码时的量化区间。
 */

import { GENERATOR_CONFIG } from '../config/constants.js';

// ---- 默认混沌参数（与 seed.js 编解码字段顺序保持一致）----
export const DEFAULT_PARAMS = {
    gravitropism: 0.5,
    phototropismX: 0.0,
    phototropismZ: 0.0,
    pruning: 0.3,
    splitAngleMin: 0.314,            // Math.PI/10
    splitAngleMax: 0.698,            // Math.PI/4.5
    lengthDecay: 0.72,
    curvinessFreq: 1.5,
    curvinessAmp: 0.18,
    rotationMin: 0.4,
    rotationMax: 2.2,
    levels: 5,
    branchesPerSplitMin: 2,
    branchesPerSplitMax: 3,
    leafiness: 0.64,
    bloom: 0.28,
    palette: -1
};

// 滑块元数据（顺序同时也是 seed.js 的字段编码顺序）
export const SLIDERS = [
    { key: 'gravitropism',        label: '向地性 Gravitropism',      min: -1,   max: 1,     step: 0.01,   default: 0.5 },
    { key: 'phototropismX',      label: '向光性 X Phototropism X',  min: -0.6, max: 0.6,   step: 0.01,   default: 0 },
    { key: 'phototropismZ',      label: '向光性 Z Phototropism Z',  min: -0.6, max: 0.6,   step: 0.01,   default: 0 },
    { key: 'pruning',            label: '修剪 Pruning',             min: 0,    max: 1,     step: 0.01,   default: 0.3 },
    { key: 'splitAngleMin',      label: '分叉角小 Split Angle min', min: 0.05, max: 1.2,   step: 0.01,   default: 0.314 },
    { key: 'splitAngleMax',      label: '分叉角大 Split Angle max', min: 0.05, max: 1.4,   step: 0.01,   default: 0.698 },
    { key: 'lengthDecay',        label: '长度衰减 Length Decay',    min: 0.55, max: 0.92,  step: 0.005,  default: 0.72 },
    { key: 'curvinessFreq',      label: '曲率频率 Curviness Freq', min: 0.5,  max: 3.0,   step: 0.05,   default: 1.5 },
    { key: 'curvinessAmp',       label: '曲率幅度 Curviness Amp',  min: 0,    max: 0.4,   step: 0.005,  default: 0.18 },
    { key: 'rotationMin',        label: '旋转小 Rotation min',     min: 0,    max: 3.14,  step: 0.05,   default: 0.4 },
    { key: 'rotationMax',        label: '旋转大 Rotation max',    min: 0,    max: 3.14,  step: 0.05,   default: 2.2 },
    { key: 'levels',             label: '层数 Levels',             min: 2,    max: 7,     step: 1,      default: 5 },
    { key: 'branchesPerSplitMin',label: '分叉数小 Branch min',     min: 2,    max: 5,     step: 1,      default: 2 },
    { key: 'branchesPerSplitMax',label: '分叉数大 Branch max',     min: 2,    max: 5,     step: 1,      default: 3 },
    { key: 'leafiness',          label: '叶片密度 Leafiness',       min: 0,    max: 1,     step: 0.01,   default: 0.64 },
    { key: 'bloom',              label: '花芽密度 Bloom',           min: 0,    max: 1,     step: 0.01,   default: 0.28 },
    { key: 'palette',            label: '叶色 Palette',             min: -1,   max: 4,     step: 1,      default: -1 },
];

export const PLANT_PRESETS = {
    canopy: {
        label: '云冠',
        params: {
            gravitropism: 0.82, phototropismX: 0, phototropismZ: 0,
            pruning: 0.12, splitAngleMin: 0.18, splitAngleMax: 0.62,
            lengthDecay: 0.76, curvinessFreq: 1.05, curvinessAmp: 0.10,
            rotationMin: 0.35, rotationMax: 1.9, levels: 5,
            branchesPerSplitMin: 2, branchesPerSplitMax: 3,
            leafiness: 0.9, bloom: 0.14, palette: 0
        }
    },
    breeze: {
        label: '风迹',
        params: {
            gravitropism: 0.28, phototropismX: 0.48, phototropismZ: -0.18,
            pruning: 0.32, splitAngleMin: 0.34, splitAngleMax: 0.86,
            lengthDecay: 0.76, curvinessFreq: 1.35, curvinessAmp: 0.28,
            rotationMin: 0.3, rotationMax: 2.7, levels: 5,
            branchesPerSplitMin: 2, branchesPerSplitMax: 3,
            leafiness: 0.66, bloom: 0.22, palette: 1
        }
    },
    coral: {
        label: '珊瑚',
        params: {
            gravitropism: 0.08, phototropismX: 0.08, phototropismZ: 0.08,
            pruning: 0.24, splitAngleMin: 0.68, splitAngleMax: 1.16,
            lengthDecay: 0.68, curvinessFreq: 2.05, curvinessAmp: 0.17,
            rotationMin: 0.95, rotationMax: 3.05, levels: 5,
            branchesPerSplitMin: 3, branchesPerSplitMax: 4,
            leafiness: 0.48, bloom: 0.38, palette: 2
        }
    },
    blossom: {
        label: '星芽',
        params: {
            gravitropism: 0.7, phototropismX: -0.08, phototropismZ: 0.12,
            pruning: 0.18, splitAngleMin: 0.3, splitAngleMax: 0.75,
            lengthDecay: 0.65, curvinessFreq: 1.6, curvinessAmp: 0.14,
            rotationMin: 0.55, rotationMax: 2.45, levels: 4,
            branchesPerSplitMin: 3, branchesPerSplitMax: 4,
            leafiness: 0.74, bloom: 0.92, palette: 3
        }
    }
};

// ---- 默认全局状态 ----
export function randomBaseSeed() {
    const { MIN_VALUE, MAX_VALUE } = GENERATOR_CONFIG.SEED;
    return Math.floor(Math.random() * (MAX_VALUE - MIN_VALUE + 1)) + MIN_VALUE;
}

export const DEFAULT_STATE = {
    baseSeed: 20250715,
    mode: 'creator',
};

// ---- 页面调色板（供 CSS var 参考与一致性）----
export const PALETTE = {
    bgTop: '#eaf7d4',
    bgBottom: '#fffeb9',
    primary: '#63c55a',
    primaryHover: '#9fc77a',
    primaryActive: '#3c8d36',
    surface: 'rgba(255,255,255,0.55)',
    textPrimary: '#3d4a33',
    textSecondary: '#8a9a7a',
    borderSoft: 'rgba(255,255,255,0.6)'
};
