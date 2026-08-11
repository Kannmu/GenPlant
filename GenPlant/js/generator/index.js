import * as THREE from "three";

import {createParameters} from './parameters.js'
import {createStructure} from './structure.js'
import {createGeometry} from './geometry.js'
import {applyMaterial} from './material.js'
import { createFoliage } from './foliage.js';


/**
 * 程序化生成一株植物
 *
 * 确定式契约：
 *   generate(seed, overrides) 仅随 overrides 的取值而变化，不受「哪些键被 override」影响——
 *   因为 createParameters 内部 *总是* 先从 PRNG 取值再判断是否覆盖，PRNG 游标前进顺序恒定。
 *
 * @param {number|string} seed      mulberry32 主种子
 * @param {object} [overrides]      可选的混沌参数覆盖（见 state/defaults.js SLIDERS）
 * @param {object} [opts]           { materialStyle:'standard'|'glass', previewQuality?:boolean }
 * @returns {THREE.Group}
 */
export function generate(seed, overrides = {}, opts = {}) {
    // 参数验证
    if (seed === null || seed === undefined) {
        throw new Error('Seed parameter is required');
    }

    const numSeed = Number(seed);
    if (isNaN(numSeed)) {
        throw new Error('Seed must be a valid number');
    }

    let parameters, structure, geometries, plant;

    try {
        parameters = createParameters(numSeed, overrides || {});
        if (!parameters) {
            throw new Error('Failed to create parameters');
        }

        structure = createStructure(parameters);
        if (!structure) {
            throw new Error('Failed to create structure');
        }

        geometries = createGeometry(parameters, structure, opts);
        if (!geometries || !Array.isArray(geometries)) {
            throw new Error('Failed to create geometry');
        }

        plant = applyMaterial(parameters, geometries, opts);
        if (!plant || !(plant instanceof THREE.Group)) {
            throw new Error('Failed to apply materials');
        }
        createFoliage(parameters, structure, plant, opts);
        plant.userData.seed = numSeed;
        plant.userData.windPhase = ((numSeed % 997) / 997) * Math.PI * 2;

        return plant;

    } catch (error) {
        console.error('Plant generation failed:', error);
        if (plant && typeof plant.dispose === 'function') {
            plant.dispose();
        }
        throw error;
    }
}
