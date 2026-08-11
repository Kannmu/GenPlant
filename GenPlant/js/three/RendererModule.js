import * as THREE from "three";
import { RENDERER_CONFIG } from '../config/constants.js';

/**
 * WebGLRenderer 封装
 * - pixelRatio 上限 min(dpr,2)，避免高分屏多植物时性能崩
 * - ACES tone mapping + sRGB，浅绿亮调下更通透
 * - webglcontextlost/restored 监听（实际恢复逻辑由 Engine 协调重生植物）
 */
export function createRendererModule(canvas) {
    const { RENDERER_SETTINGS } = RENDERER_CONFIG;
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
    });

    const deviceLimit = window.matchMedia('(pointer: coarse)').matches ? 1.4 : RENDERER_SETTINGS.MAX_PIXEL_RATIO;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, deviceLimit));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = RENDERER_SETTINGS.TONE_MAPPING_EXPOSURE;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    let shadowElapsed = 0;
    const shadowUpdateInterval = window.matchMedia('(pointer: coarse)').matches
        ? RENDERER_SETTINGS.COARSE_SHADOW_UPDATE_INTERVAL
        : RENDERER_SETTINGS.SHADOW_UPDATE_INTERVAL;

    const api = {
        renderer,
        setSize(w, h) {
            renderer.setSize(w, h, false); // false: 不改 CSS（CSS 驱动尺寸）
        },
        setPixelRatio(r) {
            renderer.setPixelRatio(Math.min(r || 1, RENDERER_SETTINGS.MAX_PIXEL_RATIO));
        },
        render(scene, camera, dt = 0) {
            shadowElapsed += dt;
            if (shadowElapsed >= shadowUpdateInterval) {
                renderer.shadowMap.needsUpdate = true;
                shadowElapsed = 0;
            }
            renderer.render(scene, camera);
        },
        requestShadowUpdate() {
            renderer.shadowMap.needsUpdate = true;
            shadowElapsed = 0;
        },
        getStats() {
            const { calls, triangles, points, lines } = renderer.info.render;
            return { calls, triangles, points, lines, geometries: renderer.info.memory.geometries };
        },
        dispose() {
            renderer.dispose();
        }
    };

    return api;
}
