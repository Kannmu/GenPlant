import * as THREE from "three";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
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
        getView() {
            return {
                position: camera.position.clone(),
                target: desiredTarget.clone()
            };
        },
        setView(view) {
            if (!view?.position || !view?.target) return false;
            camera.position.copy(view.position);
            desiredTarget.copy(view.target);
            controls.target.copy(view.target);
            controls.update();
            return true;
        },
        frameObject(object, padding = 1.35, maxDistance = CONTROLS.MAX_DISTANCE) {
            if (!object) return;
            const box = new THREE.Box3().setFromObject(object);
            if (box.isEmpty()) return;
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const verticalFov = THREE.MathUtils.degToRad(camera.fov);
            const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(camera.aspect, 0.1));
            const verticalDistance = size.y / (2 * Math.tan(verticalFov / 2));
            const horizontalDistance = size.x / (2 * Math.tan(horizontalFov / 2));
            const depthDistance = size.z * 1.25;
            const fitDistance = Math.max(verticalDistance, horizontalDistance, depthDistance, 1) * padding;
            const distance = THREE.MathUtils.clamp(fitDistance, CONTROLS.MIN_DISTANCE, Math.min(maxDistance, CONTROLS.MAX_DISTANCE));
            const direction = camera.position.clone().sub(controls.target).normalize();
            if (direction.lengthSq() < 0.5) direction.set(0.55, 0.35, 0.75).normalize();
            if (window.innerWidth < 600) direction.set(0.08, 0.28, 0.96).normalize();
            desiredTarget.copy(center);
            controls.target.copy(center);
            camera.position.copy(center).add(direction.multiplyScalar(distance));
            controls.update();
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
