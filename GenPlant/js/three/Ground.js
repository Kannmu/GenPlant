import * as THREE from "https://esm.sh/three";
import { RENDERER_CONFIG } from '../config/constants.js';

/**
 * 地面——软圆形台基 + 径向顶点色渐变 + 下方低透明菲涅尔光晕环。
 * raycast 目标 surface：用一张隐形大圆盘作为可点击范围，棋盘小球仅作视觉台基。
 *
 * 返回 { group, surface }:
 *   group    - 可见地面，加入场景
 *   surface  - 用于 raycast 命中的网格（大水平圆盘，透明、receiveShadow）
 */
export function createGround() {
    const { GROUND } = RENDERER_CONFIG;

    const group = new THREE.Group();

    // 可见台基（短圆柱）
    const radius = Math.max(0.01, GROUND.RADIUS);
    const daisGeometry = new THREE.CylinderGeometry(
        radius,
        radius,
        GROUND.HEIGHT,
        GROUND.SEGMENTS
    );
    applyRadialGradient(daisGeometry, radius, GROUND.CENTER_COLOR, GROUND.EDGE_COLOR);
    const daisMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.92,
        metalness: 0.0
    });
    daisMaterial.userData = { shared: true };
    const dais = new THREE.Mesh(daisGeometry, daisMaterial);
    dais.position.set(0, GROUND.POSITION_Y, 0);
    dais.receiveShadow = true;
    dais.castShadow = false;
    dais.userData.ground = true;
    group.add(dais);

    // raycast 用的水平大圆盘（顶视图，与台基顶面齐平）
    const surfaceRadius = Math.max(radius * 1.5, 60);
    const surfaceGeometry = new THREE.CircleGeometry(surfaceRadius, 96);
    surfaceGeometry.rotateX(-Math.PI / 2);
    // 顶点色渐变（中心亮→边缘暗一点），让放置范围有微弱暗示
    applyRadialDiskGradient(surfaceGeometry, surfaceRadius, GROUND.CENTER_COLOR, GROUND.EDGE_COLOR);
    const surfaceMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.95,
        metalness: 0.0,
        transparent: true,
        opacity: 0.0          // 完全透明，仅参与 raycast 与阴影接收
    });
    surfaceMaterial.userData = { shared: true };
    const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
    surface.position.set(0, GROUND.POSITION_Y - GROUND.HEIGHT / 2 + 0.02, 0);
    surface.receiveShadow = true;
    surface.visible = true;
    surface.userData.raycastSurface = true;
    group.add(surface);

    // 下方菲涅尔光晕环
    const glowGeometry = new THREE.RingGeometry(radius * 1.02, GROUND.GLOW_RADIUS, 96);
    glowGeometry.rotateX(-Math.PI / 2);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: GROUND.GLOW_COLOR,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    glowMaterial.userData = { shared: true };
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.set(0, GROUND.POSITION_Y - GROUND.HEIGHT / 2 - 0.05, 0);
    group.add(glow);

    group.userData.groundGroup = true;

    return { group, surface, dais };
}

/**
 * 为圆柱几何体顶面/侧面写径向渐变顶点色
 * 用 XZ 距中心半径比插值。
 */
function applyRadialGradient(geometry, radius, centerColorHex, edgeColorHex) {
    const c0 = new THREE.Color(centerColorHex);
    const c1 = new THREE.Color(edgeColorHex);
    const pos = geometry.attributes.position;
    const count = pos.count;
    const colors = new Float32Array(count * 3);
    const tmp = new THREE.Color();
    for (let i = 0; i < count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const r = Math.sqrt(x * x + z * z);
        const t = Math.min(1, Math.max(0, r / radius));
        tmp.lerpColors(c0, c1, t);
        colors[i * 3] = tmp.r;
        colors[i * 3 + 1] = tmp.g;
        colors[i * 3 + 2] = tmp.b;
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

function applyRadialDiskGradient(geometry, radius, centerColorHex, edgeColorHex) {
    const c0 = new THREE.Color(centerColorHex);
    const c1 = new THREE.Color(edgeColorHex);
    const pos = geometry.attributes.position;
    const count = pos.count;
    const colors = new Float32Array(count * 3);
    const tmp = new THREE.Color();
    for (let i = 0; i < count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const r = Math.sqrt(x * x + z * z);
        const t = Math.min(1, Math.max(0, r / radius));
        tmp.lerpColors(c0, c1, Math.pow(t, 0.7));
        colors[i * 3] = tmp.r;
        colors[i * 3 + 1] = tmp.g;
        colors[i * 3 + 2] = tmp.b;
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}