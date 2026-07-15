/**
 * ModeManager：在花园 / 造物 两种交互策略间切换。
 * - 切换时启停相应策略的 tapHandler、相机目标、预览植物可见性
 * - 不持有 three.js 强引用，行为通过 App 注入的回调完成
 */
export function createModeManager({ store, onActivateGarden, onActivateCreator, getCurrentMode }) {
    let current = null;

    function activate(mode) {
        if (mode === current) return;
        current = mode;
        if (mode === 'garden') {
            onActivateCreator && onActivateCreator(false);
            onActivateGarden && onActivateGarden(true);
        } else {
            onActivateGarden && onActivateGarden(false);
            onActivateCreator && onActivateCreator(true);
        }
    }

    // 初始激活一次
    activate(store.getState().mode);

    return {
        activate,
        get current() { return current; }
    };
}
