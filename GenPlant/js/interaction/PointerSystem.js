import { toNDC } from '../util/dom.js';

/**
 * 统一指针系统：在 renderer canvas 上区分 tap 与 drag。
 * - tap：位移 < 阈值且时长 < 时长阈值 → 触发 onTap(ndc)
 * - drag：交给 OrbitControls（不清除其手势）
 *
 * 关键：不清除/不阻止 OrbitControls 监听，二者监听同一元素，本系统仅在末次 up 时判断是否为干净 tap。
 */
export function createPointerSystem(domElement) {
    const TAP_MOVE_PX = 8;
    const TAP_TIME_MS = 300;

    let downX = 0, downY = 0, downT = 0, downButton = -1, moved = false;
    let tapHandler = null;
    let enabled = true;

    function onPointerDown(e) {
        downX = e.clientX; downY = e.clientY;
        downT = performance.now();
        downButton = e.button;
        moved = false;
    }
    function onPointerMove(e) {
        if (downT === 0) return;
        const dx = e.clientX - downX;
        const dy = e.clientY - downY;
        if (dx * dx + dy * dy > TAP_MOVE_PX * TAP_MOVE_PX) moved = true;
    }
    function onPointerUp(e) {
        if (downT === 0) return;
        const dt = performance.now() - downT;
        const wasTap = !moved && dt < TAP_TIME_MS && (downButton === 0 || e.pointerType === 'touch');
        downT = 0;
        if (!enabled) return;
        if (wasTap && typeof tapHandler === 'function') {
            const ndc = toNDC(e.clientX, e.clientY, domElement);
            try { tapHandler(ndc.x, ndc.y, e); } catch (err) { console.error('tapHandler threw:', err); }
        }
    }

    domElement.addEventListener('pointerdown', onPointerDown);
    domElement.addEventListener('pointermove', onPointerMove);
    domElement.addEventListener('pointerup', onPointerUp);

    const api = {
        setTapHandler(fn) { tapHandler = fn; },
        setEnabled(v) { enabled = !!v; },
        dispose() {
            domElement.removeEventListener('pointerdown', onPointerDown);
            domElement.removeEventListener('pointermove', onPointerMove);
            domElement.removeEventListener('pointerup', onPointerUp);
        }
    };
    return api;
}