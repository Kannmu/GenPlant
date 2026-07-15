/**
 * 模式切换 tabs：Garden / Creator
 */
export function createModeTabs(containerEl, store, onChange) {
    const buttons = containerEl.querySelectorAll('button[data-mode]');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-mode');
            store.setMode(mode);
            reflectMode(mode);
            if (typeof onChange === 'function') onChange(mode);
        });
    });

    function reflectMode(mode) {
        buttons.forEach(button => {
            const active = button.getAttribute('data-mode') === mode;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
    }

    return { reflectMode };
}
