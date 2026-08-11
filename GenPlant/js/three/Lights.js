import * as THREE from "three";
import { RENDERER_CONFIG } from '../config/constants.js';

/**
 * 场景灯光：半球 + 环境 + 平行光（带软阴影）
 */
export function createLights(scene) {
    const { LIGHTING } = RENDERER_CONFIG;

    const hemisphere = new THREE.HemisphereLight(
        LIGHTING.HEMISPHERE_LIGHT.SKY_COLOR,
        LIGHTING.HEMISPHERE_LIGHT.GROUND_COLOR,
        LIGHTING.HEMISPHERE_LIGHT.INTENSITY
    );
    scene.add(hemisphere);

    const ambient = new THREE.AmbientLight(
        LIGHTING.AMBIENT_LIGHT.COLOR,
        LIGHTING.AMBIENT_LIGHT.INTENSITY
    );
    scene.add(ambient);

    const directional = new THREE.DirectionalLight(
        LIGHTING.DIRECTIONAL_LIGHT.COLOR,
        LIGHTING.DIRECTIONAL_LIGHT.INTENSITY
    );
    const p = LIGHTING.DIRECTIONAL_LIGHT.POSITION;
    directional.position.set(p.x, p.y, p.z);
    directional.castShadow = true;
    const shadowSize = window.matchMedia('(pointer: coarse)').matches
        ? Math.min(1024, LIGHTING.DIRECTIONAL_LIGHT.SHADOW_MAP_SIZE)
        : LIGHTING.DIRECTIONAL_LIGHT.SHADOW_MAP_SIZE;
    directional.shadow.mapSize.width = shadowSize;
    directional.shadow.mapSize.height = shadowSize;
    directional.shadow.bias = LIGHTING.DIRECTIONAL_LIGHT.SHADOW_BIAS;
    directional.shadow.normalBias = LIGHTING.DIRECTIONAL_LIGHT.SHADOW_NORMAL_BIAS;

    const sc = LIGHTING.DIRECTIONAL_LIGHT.SHADOW_CAMERA;
    directional.shadow.camera.top = sc.TOP;
    directional.shadow.camera.bottom = sc.BOTTOM;
    directional.shadow.camera.left = sc.LEFT;
    directional.shadow.camera.right = sc.RIGHT;
    directional.shadow.camera.near = sc.NEAR;
    directional.shadow.camera.far = sc.FAR;
    directional.shadow.camera.updateProjectionMatrix();
    scene.add(directional);

    return {
        directional,
        setMood(mood) {
            const presets = {
                morning: { sky: 0xdcebd6, ground: 0xb8c69b, ambient: 0.38, sun: 0xfff1cf, intensity: 2.25 },
                day: { sky: 0xcfe6e3, ground: 0xaabf9c, ambient: 0.42, sun: 0xfff7df, intensity: 2.45 },
                evening: { sky: 0xf0d8c6, ground: 0xb99c83, ambient: 0.32, sun: 0xffc08d, intensity: 2.05 }
            };
            const preset = presets[mood] || presets.morning;
            hemisphere.color.setHex(preset.sky);
            hemisphere.groundColor.setHex(preset.ground);
            ambient.intensity = preset.ambient;
            directional.color.setHex(preset.sun);
            directional.intensity = preset.intensity;
        },
        // 随相机距离缩放阴影 frustum，保证花园始终在阴影范围内
        fitShadowToCamera(camera, target, margin = 45) {
            // 以地面区域近似估算（简化：固定边距并配合相机距离）
            const d = camera.position.distanceTo(target);
            const half = Math.min(120, Math.max(margin, d * 0.6));
            directional.shadow.camera.left = -half;
            directional.shadow.camera.right = half;
            directional.shadow.camera.top = half;
            directional.shadow.camera.bottom = -half;
            directional.shadow.camera.far = d + 80;
            directional.shadow.camera.updateProjectionMatrix();
        }
    };
}
