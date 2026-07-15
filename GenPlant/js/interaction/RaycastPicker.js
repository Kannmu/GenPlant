import * as THREE from "three";

/**
 * 射线拾取器：从 NDC 坐标向地面或植物发射射线。
 */
export function createRaycastPicker(camera) {
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    function setNDC(x, y) { ndc.set(x, y); raycaster.setFromCamera(ndc, camera); }

    /**
     * 命中地面表面（水平圆盘）。返回命中点 Vector3 或 null。
     */
    function pickGround(x, y, surfaceMesh) {
        if (!surfaceMesh) return null;
        setNDC(x, y);
        const hits = raycaster.intersectObject(surfaceMesh, false);
        if (hits.length === 0) return null;
        return hits[0].point.clone();
    }

    /**
     * 命中植物。returns { object, point } 或 null。
     * plantObjects 是 Mesh 数组（或 Group）。
     */
    function pickPlants(x, y, plantObjects) {
        if (!plantObjects || plantObjects.length === 0) return null;
        setNDC(x, y);
        const hits = raycaster.intersectObjects(plantObjects, true);
        if (hits.length === 0) return null;
        // 找到命中 mesh 所属的顶层组（沿 parent 上溯至 userData.plantId 标记）
        let obj = hits[0].object;
        while (obj && !obj.userData?.plantId && obj.parent) obj = obj.parent;
        return { object: obj, point: hits[0].point.clone(), distance: hits[0].distance };
    }

    return { pickGround, pickPlants, raycaster };
}