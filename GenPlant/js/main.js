/**
 * GenPlant 入口：仅构造 App，不再直接操控 DOM/渲染。
 */
import { createApp } from './app/App.js';

let app = null;

function boot() {
    try {
        app = createApp();
    } catch (err) {
        console.error('GenPlant boot failed:', err);
        const t = document.getElementById('toast');
        if (t) { t.classList.add('show'); t.textContent = '初始化失败，请刷新或换用现代浏览器'; }
    }
}

// 兼容直接打开与模块延迟
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
    boot();
}

export default app;