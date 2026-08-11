/**
 * GenPlant 入口：仅构造 App，不再直接操控 DOM/渲染。
 */
import {
    BadgePlus, Binary, CloudSun, CodeXml, Copy, Dices, Download, Ellipsis, Eraser,
    Feather, Flower, Flower2, Focus, GitBranch, Library, MoveUp, PanelLeftClose,
    PanelLeftOpen, Save, Share2, Shuffle, Sparkles, Sprout, SunMedium, Trash2, Trees,
    Undo2, WandSparkles, Waves, Wind, X
} from 'lucide';
import { createIcons } from 'lucide';
import { createApp } from './app/App.js';

let app = null;

function boot() {
    try {
        createIcons({
            icons: {
                BadgePlus, Binary, CloudSun, CodeXml, Copy, Dices, Download, Ellipsis, Eraser,
                Feather, Flower, Flower2, Focus, GitBranch, Library, MoveUp, PanelLeftClose,
                PanelLeftOpen, Save, Share2, Shuffle, Sparkles, Sprout, SunMedium, Trash2, Trees,
                Undo2, WandSparkles, Waves, Wind, X
            }
        });
        app = createApp();
        Object.defineProperty(window, '__GENPLANT__', {
            value: app,
            configurable: true
        });
    } catch (err) {
        console.error('GenPlant boot failed:', err);
        const t = document.getElementById('toast');
        if (t) { t.classList.add('show'); t.textContent = '初始化失败，请刷新或换用现代浏览器'; }
        document.getElementById('webglFallback')?.classList.remove('hidden');
    }
}

// 兼容直接打开与模块延迟
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
    boot();
}

export default app;
