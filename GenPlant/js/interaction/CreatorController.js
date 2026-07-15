import * as THREE from "three";
import { generate } from '../generator/index.js';
import { RENDERER_CONFIG } from '../config/constants.js';

/**
 * CreatorController：造物模式预览管理。
 *   - regeneratePreview(baseSeed, params, { previewQuality }) 重建场景中央预览植物
 *   - getDescriptor() 返回当前预览的 { baseSeed, params, materialStyle } 以供「种入花园」
 *
 * 预览植物锚定到场景原点上方（地面顶面），相机 target 设为预览根部。
 */
export function createCreatorController({ sceneManager, cameraRig }) {
    const PREVIEW_MATERIAL_STYLE = 'standard';
    let currentDesc = null;
    let hasFramed = false;

    localizePreviewAtOrigin();

    function regeneratePreview(baseSeed, params, opts = {}) {
        // 清旧预览（含 dispose）
        let group;
        try {
            group = generate(baseSeed, params, {
                materialStyle: opts.materialStyle || PREVIEW_MATERIAL_STYLE,
                previewQuality: opts.previewQuality !== false
            });
        } catch (err) {
            console.error('preview regen failed:', err);
            return null;
        }
        normalizePreviewToGround(group);
        sceneManager.setPreview(group);
        currentDesc = { baseSeed, params: { ...params }, materialStyle: opts.materialStyle || PREVIEW_MATERIAL_STYLE };
        const center = new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3());
        cameraRig.setTarget(center);
        if (!hasFramed) {
            cameraRig.frameObject(group, previewPadding());
            hasFramed = true;
        }
        return currentDesc;
    }

    function clearPreview() {
        sceneManager.clearPreview();
        currentDesc = null;
    }

    function getDescriptor() { return currentDesc; }

    function focus() {
        const preview = sceneManager.getPreview();
        if (preview) cameraRig.frameObject(preview, previewPadding());
    }

    function wake() {
        const preview = sceneManager.getPreview();
        if (preview) sceneManager.wake(preview);
    }

    return { regeneratePreview, clearPreview, getDescriptor, focus, wake };
}

function normalizePreviewToGround(group) {
    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxSize = Math.max(size.x, size.y, size.z) || 1;
    const s = RENDERER_CONFIG.MODEL_SCALING.DESIRED_SIZE / maxSize;
    group.scale.setScalar(s);
    const box2 = new THREE.Box3().setFromObject(group);
    const center2 = new THREE.Vector3();
    box2.getCenter(center2);
    group.position.x -= center2.x;
    group.position.z -= center2.z;
    group.position.y = RENDERER_CONFIG.GROUND.POSITION_Y + RENDERER_CONFIG.GROUND.HEIGHT / 2 - box2.min.y;

    group.traverse(function (child) {
        if (child.isMesh) {
            child.castShadow = !child.isInstancedMesh;
            child.receiveShadow = child.isInstancedMesh;
        }
    });
}

function localizePreviewAtOrigin() { /* 占位，预览即位于原点 */ }

function previewPadding() {
    return window.innerWidth < 600 ? 2.4 : 1.38;
}
