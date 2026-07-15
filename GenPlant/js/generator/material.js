import * as THREE from "https://esm.sh/three";
import { MATERIAL_CONFIG } from '../config/constants.js';

/**
 * 材质生成
 *
 * 优化：顶点色梯度已写入 geometry 的 color attribute，材质 vertexColors=true 即可。
 * 因此每个 style 共享一个材质实例，不再为每个 level 缓存不同材质 —— 配成一次建好即可。
 * 顶点色 r/g/b 取值 [0,1]，用 baseColor-tipColor 在着色器里做 lerp（vertexColor 作为 t）。
 * 这里通过 onBeforeCompile 注入或更简单地：把 color attribute 直接作为 multiplier 用 vertexColors，
 * 标准 MeshStandardMaterial 会把颜色与 material.color 相乘。所以我们设置 material.color 为白色，
 * 在 geometry 里直接写入「插值后的真实颜色」即可让一层材质复用所有枝段。
 *
 * 实现：在 applyMaterial 中按 levelProgress 直接写入真正的插值色到 color attribute。
 */

const baseColor = new THREE.Color(MATERIAL_CONFIG.COLORS.BASE_COLOR);
const tipColor = new THREE.Color(MATERIAL_CONFIG.COLORS.TIP_COLOR);

// 共享材质实例缓存：按 style 单实例
let standardMaterial = null;
let glassMaterial = null;

export function applyMaterial(parameters, geometries, opts = {}) {
    const plant = new THREE.Group();
    const material = getSharedMaterial(opts.materialStyle || MATERIAL_CONFIG.STYLES.STANDARD);

    const maxLevels = (parameters && parameters.structure && parameters.structure.branching)
        ? parameters.structure.branching.levels
        : 1;
    void maxLevels;

    for (const entry of geometries) {
        if (entry && entry.geometry) {
            writeVertexColors(entry.geometry, entry.levelProgress);
            const mesh = new THREE.Mesh(entry.geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = false;
            plant.add(mesh);
        }
    }
    return plant;
}

/**
 * 将「按 levelProgress 在 baseColor->tipColor 间插值的真实颜色」写入 color attribute，
 * 使单一共享材质即可表现整株梯度，无需每段独立材质。
 */
function writeVertexColors(geometry, levelProgress) {
    if (!geometry.getAttribute('color')) return;
    const t = THREE.MathUtils.clamp(levelProgress ?? 0, 0, 1);
    const c = new THREE.Color().lerpColors(baseColor, tipColor, t);
    const colorAttr = geometry.attributes.color;
    const count = colorAttr.count;
    const arr = colorAttr.array;
    for (let i = 0; i < count; i++) {
        arr[i * 3] = c.r;
        arr[i * 3 + 1] = c.g;
        arr[i * 3 + 2] = c.b;
    }
    colorAttr.needsUpdate = true;
}

function getSharedMaterial(style) {
    const { PROPERTIES } = MATERIAL_CONFIG;
    if (style === MATERIAL_CONFIG.STYLES.GLASS) {
        if (!glassMaterial) {
            glassMaterial = new THREE.MeshPhysicalMaterial({
                color: 0xffffff,
                vertexColors: true,
                roughness: PROPERTIES.BASE_ROUGHNESS,
                metalness: PROPERTIES.METALNESS,
                transmission: PROPERTIES.GLASS_TRANSMISSION,
                thickness: PROPERTIES.GLASS_THICKNESS,
                ior: PROPERTIES.GLASS_IOR,
                clearcoat: PROPERTIES.GLASS_CLEARCOAT,
                clearcoatRoughness: PROPERTIES.GLASS_CLEARCOAT_ROUGHNESS,
                transparent: true,
                side: THREE.DoubleSide
            });
            glassMaterial.userData.shared = true;
        }
        return glassMaterial;
    }
    if (!standardMaterial) {
        standardMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            vertexColors: true,
            roughness: PROPERTIES.BASE_ROUGHNESS,
            metalness: PROPERTIES.METALNESS
        });
        standardMaterial.userData.shared = true;
    }
    return standardMaterial;
}

/**
 * 释放共享材质资源（仅在彻底销毁场景，如切换主题 / context 丢失重建时调用）
 * 普通植物 add/remove 不应调用，否则跨植物共享材质被破坏。
 */
export function disposeSharedMaterials() {
    if (standardMaterial) { standardMaterial.dispose(); standardMaterial = null; }
    if (glassMaterial) { glassMaterial.dispose(); glassMaterial = null; }
}