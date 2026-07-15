import { init, randomFloat, randomFloatNormal, randomFloatSurprise, randomInt, choice } from '../util/random.js';
import * as THREE from "three";
import { PARAMETER_CONFIG } from '../config/constants.js';

/**
 * 造物参数生成
 *
 * 关键设计 — pickOverride 保证「显式覆盖仍确定式」：
 * 对每个可被滑块覆盖的值，*永远先从 PRNG 取一次*，再用 override 覆盖（若有）。
 * 这样无论 override 与否，PRNG 游标前进完全一致 →
 *   改一个滑块只改变对应特征，其余骨架稳定（良好混沌编辑体验）；
 *   generate(seed, {gravitropism:x}) 与一个默认取值恰为 x 的 plant 产生逐字节相同的下游。
 *
 * 可被 override 的键（与 state/defaults.js SLIDERS 对应）：
 *   gravitropism, phototropismX, phototropismZ, pruning,
 *   splitAngleMin, splitAngleMax, lengthDecay, curvinessFreq, curvinessAmp,
 *   rotationMin, rotationMax, levels, branchesPerSplitMin, branchesPerSplitMax
 */

export function createParameters(seed, overrides = {}) {
    init(seed);

    return {
        global: {
            seed: Number(seed),
        },
        archetype: createArchetypeParameters(),
        environment: createEnvironmentParameters(overrides),
        structure: createStructureParameters(overrides),
        appearance: createAppearanceParameters(seed, overrides),
    };
}

function createAppearanceParameters(seed, overrides) {
    const fallbackPalette = hashSeed(seed) % 5;
    const requestedPalette = Number(overrides.palette);
    const palette = Number.isFinite(requestedPalette) && requestedPalette >= 0
        ? Math.min(4, Math.round(requestedPalette))
        : fallbackPalette;

    return {
        leafiness: clamp01(overrides.leafiness ?? 0.64),
        bloom: clamp01(overrides.bloom ?? 0.28),
        palette
    };
}

function clamp01(value) {
    return Math.min(1, Math.max(0, Number(value) || 0));
}

function hashSeed(seed) {
    let x = Number(seed) >>> 0;
    x ^= x >>> 16;
    x = Math.imul(x, 0x7feb352d);
    x ^= x >>> 15;
    x = Math.imul(x, 0x846ca68b);
    return (x ^ (x >>> 16)) >>> 0;
}

function pickOverride(overrides, key, drawFn) {
    const drawn = drawFn(); // 始终消耗 PRNG
    if (overrides && overrides[key] !== undefined && overrides[key] !== null && isFinite(overrides[key])) {
        return overrides[key];
    }
    return drawn;
}

function createArchetypeParameters() {
    const { ARCHETYPE } = PARAMETER_CONFIG;
    const { SCALE_RANGE } = ARCHETYPE;

    return {
        type: choice(ARCHETYPE.AVAILABLE_TYPES),
        growthForm: randomFloatSurprise(0.5, 0.2, 0, 1, 0.08),
        age: randomFloatSurprise(0.5, 0.25, 0, 1, 0.06),
        scale: new THREE.Vector3(
            randomFloat(SCALE_RANGE.MIN, SCALE_RANGE.MAX),
            randomFloat(SCALE_RANGE.MIN, SCALE_RANGE.MAX),
            randomFloat(SCALE_RANGE.MIN, SCALE_RANGE.MAX)
        ),
    };
}

function createEnvironmentParameters(overrides) {
    const { ENVIRONMENT } = PARAMETER_CONFIG;
    const { PHOTOTROPISM } = ENVIRONMENT;

    return {
        phototropism: new THREE.Vector3(
            pickOverride(overrides, 'phototropismX', () => randomFloat(PHOTOTROPISM.X_RANGE.MIN, PHOTOTROPISM.X_RANGE.MAX)),
            PHOTOTROPISM.Y_VALUE,
            pickOverride(overrides, 'phototropismZ', () => randomFloat(PHOTOTROPISM.Z_RANGE.MIN, PHOTOTROPISM.Z_RANGE.MAX))
        ),
        gravitropism: pickOverride(overrides, 'gravitropism',
            () => randomFloatSurprise(0.5, 0.3, ENVIRONMENT.GRAVITROPISM_RANGE.MIN, ENVIRONMENT.GRAVITROPISM_RANGE.MAX, 0.1)),
        pruningFactor: pickOverride(overrides, 'pruning', () => randomFloat(0, 1)),
        lightIntensity: randomFloat(0, 1),
        temperature: randomFloat(0, 1),
        humidity: randomFloat(0, 1),
    };
}

function createStructureParameters(overrides) {
    const { STRUCTURE } = PARAMETER_CONFIG;

    return {
        trunk: createTrunkParameters(STRUCTURE.TRUNK, overrides),
        branching: createBranchingParameters(STRUCTURE.BRANCHING, overrides),
    };
}

function createTrunkParameters(trunkConfig, overrides) {
    const { TAPER_RANGE, CURVINESS } = trunkConfig;

    const freq = pickOverride(overrides, 'curvinessFreq', () => CURVINESS.FREQUENCY);
    const amp = pickOverride(overrides, 'curvinessAmp', () => CURVINESS.AMPLITUDE);

    return {
        taperRange: {
            min: randomFloat(TAPER_RANGE.MIN.MIN, TAPER_RANGE.MIN.MAX),
            max: randomFloat(TAPER_RANGE.MAX.MIN, TAPER_RANGE.MAX.MAX)
        },
        curviness: new THREE.Vector2(freq, amp),
    };
}

function createBranchingParameters(branchingConfig, overrides) {
    const {
        LEVELS_RANGE,
        BRANCHES_PER_SPLIT,
        SPLIT_ANGLE,
        LENGTH_DECAY_RANGE,
        CURVINESS,
        ROTATION_ANGLE
    } = branchingConfig;

    const levelsOverride = overrides.levels;
    const splitMin = pickOverride(overrides, 'splitAngleMin', () =>
        randomFloatSurprise(
            (SPLIT_ANGLE.MIN + SPLIT_ANGLE.MAX) / 2,
            (SPLIT_ANGLE.MAX - SPLIT_ANGLE.MIN) / 6,
            SPLIT_ANGLE.MIN, SPLIT_ANGLE.MAX, 0.12));
    const splitMax = pickOverride(overrides, 'splitAngleMax', () =>
        randomFloatSurprise(
            (SPLIT_ANGLE.MIN + SPLIT_ANGLE.MAX) / 2,
            (SPLIT_ANGLE.MAX - SPLIT_ANGLE.MIN) / 6,
            SPLIT_ANGLE.MIN, SPLIT_ANGLE.MAX, 0.12));
    const lengthDecay = pickOverride(overrides, 'lengthDecay',
        () => randomFloatSurprise(0.7, 0.1, LENGTH_DECAY_RANGE.MIN, LENGTH_DECAY_RANGE.MAX, 0.07));
    const curvAmp = pickOverride(overrides, 'curvinessAmp', () => CURVINESS.AMPLITUDE);
    const curvFreq = pickOverride(overrides, 'curvinessFreq', () => CURVINESS.FREQUENCY);
    const rotMin = pickOverride(overrides, 'rotationMin',
        () => randomFloat(ROTATION_ANGLE.MIN_RANGE.MIN, ROTATION_ANGLE.MIN_RANGE.MAX));
    const rotMax = pickOverride(overrides, 'rotationMax',
        () => randomFloat(ROTATION_ANGLE.MAX_RANGE.MIN, ROTATION_ANGLE.MAX_RANGE.MAX));
    const branchMin = pickOverride(overrides, 'branchesPerSplitMin',
        () => randomInt(BRANCHES_PER_SPLIT.MIN, BRANCHES_PER_SPLIT.MAX));
    const branchMax = pickOverride(overrides, 'branchesPerSplitMax',
        () => randomInt(BRANCHES_PER_SPLIT.MIN, BRANCHES_PER_SPLIT.MAX));

    const levels = (levelsOverride !== undefined && levelsOverride !== null && isFinite(levelsOverride))
        ? Math.round(levelsOverride)
        : randomInt(LEVELS_RANGE.MIN, LEVELS_RANGE.MAX);

    return {
        levels,
        branchesPerSplit: {
            min: Math.max(Math.round(branchMin), 1),
            max: Math.max(Math.round(branchMax), Math.round(branchMin))
        },
        splitAngleRange: {
            min: Math.min(splitMin, splitMax),
            max: Math.max(splitMin, splitMax)
        },
        lengthDecay,
        curviness: new THREE.Vector2(curvFreq, curvAmp),
        rotationAngleRange: {
            min: Math.min(rotMin, rotMax),
            max: Math.max(rotMin, rotMax)
        },
    };
}
