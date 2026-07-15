import * as THREE from "https://esm.sh/three";
import { OrbitControls } from 'https://esm.sh/three/examples/jsm/controls/OrbitControls.js';
import { RENDERER_CONFIG } from '../config/constants.js';

/**
 * 相机 + OrbitControls 封装
 * - 双目标：花园导航(质心)/聚焦选中(单株)；切换时 target lerp 平滑，避免跳变
 * - 触控：单指旋转、双指缩放/平移
 * - 自带 damping
 *
 * 接口：
 *   camera, controls
 *   setTarget(Vector3, animate=true)
 *   update(dt)  —— 驱动 lerp
 *   reset()
 *   setAutoRotate(bool)
 *   dispose()
 */
export function createCameraRig(canvas, cameraTarget) {
    const { CAMERA, CONTROLS } = RENDERER_CONFIG;

    const camera = new THREE.PerspectiveCamera(
        CAMERA.FOV,
        1, // aspect 由 Engine.resize 更新
        CAMERA.NEAR,
        CAMERA.FAR
    );
    camera.position.copy(CAMERA.INITIAL_POSITION);
    camera.lookAt(CAMERA.INITIAL_LOOKAT);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = CONTROLS.DAMPING_FACTOR;
    controls.screenSpacePanning = false;
    controls.enablePan = true;
    controls.minDistance = CONTROLS.MIN_DISTANCE;
    controls.maxDistance = CONTROLS.MAX_DISTANCE;
    controls.maxPolarAngle = CONTROLS.MAX_POLAR_ANGLE;
    controls.autoRotate = false;
    controls.autoRotateSpeed = CONTROLS.AUTO_ROTATE_SPEED;
    controls.target.copy(cameraTarget || CAMERA.INITIAL_LOOKAT);
    if (controls.touches) {
        controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    }

    let desiredTarget = controls.target.clone();

    const api = {
        camera,
        controls,
        setActive(enabled) {
            controls.enabled = enabled;
        },
        setTarget(target, animate = true) {
            desiredTarget.copy(target);
            if (!animate) {
                controls.target.copy(desiredTarget);
            }
        },
        getTarget() {
            return desiredTarget.clone();
        },
        update(dt) {
            if (controls.enabled) {
                // lerp 当前 target -> desiredTarget
                controls.target.lerp(desiredTarget, CONTROLS.TARGET_LERP);
                controls.update(dt);
            }
        },
        reset() {
            camera.position.copy(CAMERA.INITIAL_POSITION);
            desiredTarget.copy(CAMERA.INITIAL_LOOKAT);
            controls.target.copy(CAMERA.INITIAL_LOOKAT);
            controls.update();
        },
        setAutoRotate(on) {
            controls.autoRotate = on;
        },
        dispose() {
            controls.dispose();
        }
    };

    return api;
}