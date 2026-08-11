import * as THREE from "three";
import { RENDERER_CONFIG } from '../config/constants.js';

/**
 * PlantInstance：一株植物的运行时包装。
 * 持有 group + 描述符（baseSeed/params/materialStyle）+ 世界变换 + 生长状态。
 */
export let idCounter = 0;
let nextSeedSeq = 0;

export function createPlantInstance({ group, baseSeed, params, materialStyle = 'standard', x = 0, z = 0, rotationY = 0 }) {
    const id = 'pl_' + (idCounter++).toString(36) + '_' + (nextSeedSeq++).toString(36);
    group.userData.plantId = id;

    // 缩放并锚定：把植物 bbox 底部置于 y=0（局部坐标系），随后由 group.position 落到地面点
    normalizeToGroundOrigin(group);

    group.position.set(x, groundBaseY(), z);
    group.rotation.y = rotationY;
    const focusPoint = new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3());

    const instance = {
        id,
        group,
        baseSeed,
        params,
        materialStyle,
        createdAt: performance.now(),
        growth: 0,          // 0..1 生长进度
        growing: true,
        disposed: false,
        focusPoint,
        descriptor: {            // 序列化用
            seed: '',
            x, z, rotationY
        }
    };
    return instance;
}

function groundBaseY() {
    // 局部底面落在 groundSurface 高度（与 Ground 中 surface.position.y 对齐）
    return RENDERER_CONFIG.GROUND.POSITION_Y + RENDERER_CONFIG.GROUND.HEIGHT / 2;
}

/**
 * 把 group 内的所有 mesh 规范化：等比缩放到 DESIRED_SIZE，
 * 平移使 bbox 最低点在 y=0、中心在 x=0,z=0。
 */
function normalizeToGroundOrigin(group) {
    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const maxSize = Math.max(size.x, size.y, size.z) || 1;
    const s = RENDERER_CONFIG.MODEL_SCALING.DESIRED_SIZE / maxSize;
    group.scale.setScalar(s);

    // 重新算 bbox 以处理 scale
    const box2 = new THREE.Box3().setFromObject(group);
    const center2 = new THREE.Vector3();
    box2.getCenter(center2);

    // 如果 group 自身已有 position 偏移（generate 内部居中），这里以平移组 position 抵消
    group.position.x -= center2.x;
    group.position.z -= center2.z;
    group.position.y -= box2.min.y; // 底对到 y=0
}

export function setInstanceRotationY(instance, ry) {
    instance.group.rotation.y = ry;
    instance.descriptor.rotationY = ry;
}

export function setInstancePosition(instance, x, z) {
    instance.group.position.set(x, groundBaseY(), z);
    instance.descriptor.x = x;
    instance.descriptor.z = z;
}
