/**
 * 模式切换 tabs：Garden / Creator
 */
export function createModeTabs(containerEl, store, onChange) {
    const buttons = containerEl.querySelectorAll('button[data-mode]');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-mode');
            store.setMode(mode);
            buttons.forEach(b => b.classList.toggle('active', b === btn));
            if (typeof onChange === 'function') onChange(mode);
        });
    });

    function reflectMode(mode) {
        buttons.forEach(b => b.classList.toggle('active', b.getAttribute('data-mode') === mode));
    }

    return { reflectMode };
}