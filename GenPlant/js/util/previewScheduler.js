/**
 * 帧对齐的实时预览节流器。持续输入时按固定间隔取最新状态执行，
 * 不会像 debounce 一样一直等到用户停止操作。
 */
export function createLivePreviewScheduler(callback, intervalMs = 48, runtime = {}) {
    const now = runtime.now || (() => performance.now());
    const setTimer = runtime.setTimeout || ((fn, delay) => setTimeout(fn, delay));
    const clearTimer = runtime.clearTimeout || (id => clearTimeout(id));
    const requestFrame = runtime.requestAnimationFrame || (fn => requestAnimationFrame(fn));
    const cancelFrame = runtime.cancelAnimationFrame || (id => cancelAnimationFrame(id));
    let timerId = null;
    let frameId = null;
    let pending = false;
    let lastStartedAt = -Infinity;

    function run() {
        frameId = null;
        if (!pending) return;
        pending = false;
        lastStartedAt = now();
        callback();
        if (pending) schedule();
    }

    function schedule() {
        pending = true;
        if (timerId !== null || frameId !== null) return;
        const wait = Math.max(0, intervalMs - (now() - lastStartedAt));
        timerId = setTimer(() => {
            timerId = null;
            frameId = requestFrame(run);
        }, wait);
    }

    function cancel() {
        pending = false;
        if (timerId !== null) clearTimer(timerId);
        if (frameId !== null) cancelFrame(frameId);
        timerId = null;
        frameId = null;
    }

    return { schedule, cancel };
}
