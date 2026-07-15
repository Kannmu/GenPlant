/**
 * 轻量 Toast 提示
 */
export function createToast(el) {
    let timer = null;

    function show(message, duration = 2200) {
        if (!el) return;
        el.textContent = message;
        el.classList.add('show');
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => el.classList.remove('show'), duration);
    }

    function hide() {
        if (!el) return;
        el.classList.remove('show');
        if (timer) { clearTimeout(timer); timer = null; }
    }

    return { show, hide };
}