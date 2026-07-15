import * as THREE from 'three';
import { MATERIAL_CONFIG } from '../config/constants.js';

const UP = new THREE.Vector3(0, 1, 0);
let sharedLeafGeometry = null;
let sharedBloomGeometry = null;
const leafMaterials = new Map();
const bloomMaterials = new Map();

export function createFoliage(parameters, structure, plant, opts = {}) {
    const appearance = parameters.appearance || {};
    const tips = collectTips(structure);
    if (tips.length === 0 || appearance.leafiness <= 0.01) return plant;

    const qualityScale = opts.previewQuality ? 0.58 : 1;
    const maxLeaves = Math.max(12, Math.floor(420 * qualityScale));
    const rand = mulberry32(((parameters.global.seed >>> 0) ^ 0x9e3779b9) >>> 0);
    const palette = MATERIAL_CONFIG.PALETTES[appearance.palette] || MATERIAL_CONFIG.PALETTES[0];
    const selectedTips = sampleTips(tips, maxLeaves, rand);
    const leavesPerTip = appearance.leafiness > 0.72 ? 2 : 1;
    const leafCount = Math.min(maxLeaves, selectedTips.length * leavesPerTip);

    const leafGeometry = getLeafGeometry();
    const leafMaterial = getLeafMaterial(appearance.palette);
    const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, leafCount);
    leaves.name = 'foliage';
    leaves.castShadow = false;
    leaves.receiveShadow = true;
    leaves.frustumCulled = true;

    const baseLeaf = new THREE.Color(palette.leafBase);
    const tipLeaf = new THREE.Color(palette.leafTip);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const twist = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    let leafIndex = 0;

    for (let i = 0; i < selectedTips.length && leafIndex < leafCount; i++) {
        const tip = selectedTips[i];
        const position = tip.curve.getPointAt(1);
        const tangent = tip.curve.getTangentAt(1).normalize();
        const pairCount = Math.min(leavesPerTip, leafCount - leafIndex);
        for (let p = 0; p < pairCount; p++) {
            quaternion.setFromUnitVectors(UP, tangent);
            twist.setFromAxisAngle(tangent, (p * Math.PI) + (rand() - 0.5) * 0.8);
            quaternion.premultiply(twist);
            const size = 0.17 + rand() * 0.13;
            scale.set(size * (0.72 + rand() * 0.22), size * (1.18 + rand() * 0.32), 1);
            matrix.compose(position, quaternion, scale);
            leaves.setMatrixAt(leafIndex, matrix);
            leaves.setColorAt(leafIndex, new THREE.Color().lerpColors(baseLeaf, tipLeaf, 0.25 + rand() * 0.75));
            leafIndex++;
        }
    }
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    leaves.computeBoundingBox();
    leaves.computeBoundingSphere();
    plant.add(leaves);

    const bloomChance = Math.pow(appearance.bloom || 0, 1.25);
    const bloomTips = selectedTips.filter(() => rand() < bloomChance * 0.55);
    if (bloomTips.length > 0) addBlooms(plant, bloomTips, palette.bloom, rand, qualityScale);
    return plant;
}

function createLeafGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.55);
    shape.bezierCurveTo(-0.34, -0.18, -0.32, 0.34, 0, 0.62);
    shape.bezierCurveTo(0.32, 0.34, 0.34, -0.18, 0, -0.55);
    const geometry = new THREE.ShapeGeometry(shape, 5);
    geometry.computeVertexNormals();
    return geometry;
}

function getLeafGeometry() {
    if (!sharedLeafGeometry) {
        sharedLeafGeometry = createLeafGeometry();
        sharedLeafGeometry.userData.shared = true;
    }
    return sharedLeafGeometry;
}

function getBloomGeometry() {
    if (!sharedBloomGeometry) {
        sharedBloomGeometry = new THREE.OctahedronGeometry(0.13, 0);
        sharedBloomGeometry.userData.shared = true;
    }
    return sharedBloomGeometry;
}

function getLeafMaterial(paletteIndex) {
    const key = Number(paletteIndex) || 0;
    if (!leafMaterials.has(key)) {
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.72,
            metalness: 0,
            side: THREE.DoubleSide,
            vertexColors: false
        });
        material.userData.shared = true;
        leafMaterials.set(key, material);
    }
    return leafMaterials.get(key);
}

function getBloomMaterial(color) {
    const key = Number(color) || 0;
    if (!bloomMaterials.has(key)) {
        const material = new THREE.MeshStandardMaterial({
            color,
            roughness: 0.64,
            metalness: 0,
            flatShading: true
        });
        material.userData.shared = true;
        bloomMaterials.set(key, material);
    }
    return bloomMaterials.get(key);
}

function addBlooms(plant, tips, color, rand, qualityScale) {
    const count = Math.min(tips.length, Math.floor(90 * qualityScale));
    const geometry = getBloomGeometry();
    const material = getBloomMaterial(color);
    const blooms = new THREE.InstancedMesh(geometry, material, count);
    blooms.name = 'blooms';
    blooms.castShadow = false;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
        const position = tips[i].curve.getPointAt(1);
        quaternion.setFromAxisAngle(UP, rand() * Math.PI * 2);
        const size = 0.72 + rand() * 0.42;
        scale.set(size, size * (0.78 + rand() * 0.25), size);
        matrix.compose(position, quaternion, scale);
        blooms.setMatrixAt(i, matrix);
    }
    blooms.instanceMatrix.needsUpdate = true;
    blooms.computeBoundingBox();
    blooms.computeBoundingSphere();
    plant.add(blooms);
}

function collectTips(root) {
    const tips = [];
    const stack = [root];
    while (stack.length) {
        const node = stack.pop();
        if (!node) continue;
        if (node.curve && (!node.children || node.children.length === 0)) tips.push(node);
        if (node.children) stack.push(...node.children);
    }
    return tips;
}

function sampleTips(tips, maxCount, rand) {
    const target = Math.min(tips.length, maxCount);
    if (tips.length <= target) return tips;
    const copy = tips.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, target);
}

function mulberry32(seed) {
    return function random() {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function disposeFoliageResources() {
    sharedLeafGeometry?.dispose();
    sharedBloomGeometry?.dispose();
    sharedLeafGeometry = null;
    sharedBloomGeometry = null;
    for (const material of leafMaterials.values()) material.dispose();
    for (const material of bloomMaterials.values()) material.dispose();
    leafMaterials.clear();
    bloomMaterials.clear();
}
