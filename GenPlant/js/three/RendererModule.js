import * as THREE from "https://esm.sh/three";
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

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDERER_SETTINGS.MAX_PIXEL_RATIO));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = RENDERER_SETTINGS.TONE_MAPPING_EXPOSURE;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const api = {
        renderer,
        setSize(w, h) {
            renderer.setSize(w, h, false); // false: 不改 CSS（CSS 驱动尺寸）
        },
        setPixelRatio(r) {
            renderer.setPixelRatio(Math.min(r || 1, RENDERER_SETTINGS.MAX_PIXEL_RATIO));
        },
        render(scene, camera) {
            renderer.render(scene, camera);
        },
        dispose() {
            renderer.dispose();
        }
    };

    return api;
}