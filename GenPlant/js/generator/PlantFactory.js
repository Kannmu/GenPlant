import { encodeState } from '../core/seed.js';
import { generate } from './index.js';

/**
 * 花园植物原型缓存。同一模板只递归生成一次，后续放置共享静态几何与材质，
 * 每个实例仅保留自己的变换、实例矩阵和生长状态。
 */
export function createPlantFactory() {
    const prototypes = new Map();

    function keyFor(baseSeed, params, materialStyle) {
        return `${materialStyle || 'standard'}:${encodeState({ baseSeed, params })}`;
    }

    function getOrCreate(baseSeed, params, materialStyle = 'standard') {
        const key = keyFor(baseSeed, params, materialStyle);
        let prototype = prototypes.get(key);
        if (!prototype) {
            prototype = generate(baseSeed, params, { materialStyle, previewQuality: false });
            prototype.traverse(child => {
                if (!child.geometry || child.geometry.userData?.shared) return;
                child.geometry.userData = {
                    ...child.geometry.userData,
                    shared: true,
                    factoryOwned: true
                };
            });
            prototypes.set(key, prototype);
        }
        return prototype;
    }

    function create(baseSeed, params, materialStyle = 'standard') {
        return getOrCreate(baseSeed, params, materialStyle).clone(true);
    }

    function warm(baseSeed, params, materialStyle = 'standard') {
        getOrCreate(baseSeed, params, materialStyle);
    }

    function dispose() {
        const disposed = new Set();
        for (const prototype of prototypes.values()) {
            prototype.traverse(child => {
                const geometry = child.geometry;
                if (!geometry?.userData?.factoryOwned || disposed.has(geometry)) return;
                disposed.add(geometry);
                geometry.dispose();
            });
        }
        prototypes.clear();
    }

    return {
        create,
        warm,
        dispose,
        get size() { return prototypes.size; }
    };
}
