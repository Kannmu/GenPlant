/**
 * 玻璃面板组件 — 控制造物模式面板的折叠/展开。
 * 空区 pointer-events 由 overlay 全局 none + 控件 auto 负责，此模块只管折叠态。
 */
export function createPanel(panelEl, toggleEl, { label = '面板' } = {}) {
    let collapsed = false;

    function setCollapsed(c) {
        collapsed = c;
        if (!panelEl) return;
        panelEl.classList.toggle('collapsed', collapsed);
        if (toggleEl) {
            toggleEl.title = collapsed ? '展开' : '折叠';
            toggleEl.setAttribute('aria-label', collapsed ? `展开${label}` : `收起${label}`);
            toggleEl.setAttribute('aria-expanded', String(!collapsed));
            toggleEl.dataset.tooltip = collapsed ? `展开${label}` : `收起${label}`;
            toggleEl.classList.toggle('is-collapsed', collapsed);
        }
    }

    function toggle() { setCollapsed(!collapsed); }

    if (toggleEl) toggleEl.addEventListener('click', toggle);
    setCollapsed(false);

    return { setCollapsed, toggle, isCollapsed: () => collapsed };
}
