import * as THREE from "three";
import { RENDERER_CONFIG } from '../config/constants.js';
import { createRendererModule } from './RendererModule.js';
import { createSceneManager } from './SceneManager.js';
import { createCameraRig } from './CameraRig.js';

/**
 * Engine：拥有场景/相机/渲染器/clock 与单一 animate 循环。
 * - ResizeObserver 观察父容器（不是 canvas 自身，避免反馈环），驱动 camera aspect + renderer size。
 * - webglcontextlost/restored：标志位 + 委托 SceneManager/回调渐进重建。
 * - 对外暴露 onContextRestored 回调供上层（App）重生花园。
 */
export function createEngine(canvas) {
    const { CAMERA, GROUND } = RENDERER_CONFIG;
    let rafId = null;
    let contextLost = false;
    let running = false;
    let lastFrameTime = performance.now();

    const sceneManager = createSceneManager();
    const rendererModule = createRendererModule(canvas);
    const cameraRig = createCameraRig(canvas, sceneManager.groundDais.position.clone());
    cameraRig.camera.aspect = 1;

    // 每帧 update 回调队列（garden growth、selection 动画等注册于此）
    const updaters = new Set();
    function addUpdater(fn) { if (typeof fn === 'function') updaters.add(fn); return () => updaters.delete(fn); }

    const api = {
        sceneManager,
        renderer: rendererModule,
        camera: cameraRig.camera,
        controls: cameraRig.controls,
        cameraRig,
        addUpdater,
        getStats() { return rendererModule.getStats(); },
        get contextLost() { return contextLost; },

        // 由 App 注册：context 恢复后渐进重生花园
        onContextRestored: null,

        start() {
            if (running) return;
            running = true;
            lastFrameTime = performance.now();
            rafId = requestAnimationFrame(animate);
        },

        stop() {
            running = false;
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        },

        resize(w, h) {
            if (w <= 0 || h <= 0) return;
            rendererModule.setSize(w, h);
            cameraRig.camera.aspect = w / h;
            cameraRig.camera.updateProjectionMatrix();
            sceneManager.lights.fitShadowToCamera(cameraRig.camera, cameraRig.controls.target);
            rendererModule.requestShadowUpdate();
        },

        dispose() {
            api.stop();
            ro.disconnect();
            canvas.removeEventListener('webglcontextlost', handleContextLost);
            canvas.removeEventListener('webglcontextrestored', handleContextRestored);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            cameraRig.dispose();
            sceneManager.dispose();
            rendererModule.dispose();
        }
    };

    function animate(now) {
        if (!running) return;
        rafId = requestAnimationFrame(animate);
        if (contextLost) return; // 丢失期间不渲染
        const dt = Math.min(0.05, Math.max(0, (now - lastFrameTime) / 1000));
        lastFrameTime = now;
        for (const fn of [...updaters]) {
            try { fn(dt); } catch (err) { console.error('engine updater threw:', err); }
        }
        sceneManager.update(dt);
        cameraRig.update(dt);
        rendererModule.render(sceneManager.scene, cameraRig.camera, dt);
    }

    // ---- ResizeObserver：观察父容器 ----
    const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const cr = entry.contentRect;
            api.resize(cr.width, cr.height);
        }
    });
    // canvas 的父就是 stage
    const parent = canvas.parentElement || canvas;
    ro.observe(parent);
    // 初始尺寸
    const rect = parent.getBoundingClientRect();
    if (rect.width && rect.height) api.resize(rect.width, rect.height);

    // ---- visibility：隐藏时暂停以省电 ----
    function handleVisibilityChange() {
        if (document.hidden) {
            api.stop();
        } else if (!contextLost) {
            api.start();
        }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange, false);

    // ---- WebGL context loss / restore ----
    function handleContextLost(e) {
        e.preventDefault();
        contextLost = true;
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        console.warn('GenPlant: WebGL context lost — will restore on restore event.');
    }
    function handleContextRestored() {
        contextLost = false;
        // WebGLRenderer 内部会重建上下文与资源。我们的程序化几何无纹理，
        // 但 GPU buffer 已失效 -> 由 App 通过 onContextRestored 回调重生植物。
        if (typeof api.onContextRestored === 'function') {
            try { api.onContextRestored(); } catch (err) { console.error('onContextRestored threw:', err); }
        }
        lastFrameTime = performance.now();
        if (running) {
            // ensure loop restarted
            running = false;
            api.start();
        } else {
            api.start();
        }
    }
    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

    return api;
}
