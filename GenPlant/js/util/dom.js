/**
 * DOM 与通用前端的轻量工具集
 * 提供 debounce、NDC 换算、clamp 等不依赖 three.js 的辅助函数
 */

/**
 * 将值限制在 [min, max] 区间
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * 创建防抖函数：仅在事件静默 wait 毫秒后执行一次
 * @param {Function} fn
 * @param {number} wait
 * @returns {Function} 取消后再调用会重新计时；含 .cancel() 方法和 .flush()
 */
export function debounce(fn, wait) {
    if (typeof fn !== 'function') {
        throw new Error('debounce: fn must be a function');
    }
    let timer = null;
    let lastArgs = null;
    let lastThis = null;

    const debounced = function (...args) {
        lastArgs = args;
        lastThis = this;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            fn.apply(lastThis, lastArgs);
            lastArgs = null;
            lastThis = null;
        }, wait);
    };

    debounced.cancel = function () {
        if (timer) {
            clearTimeout(timer);
            timer = null;
            lastArgs = null;
            lastThis = null;
        }
    };

    debounced.flush = function () {
        if (timer) {
            clearTimeout(timer);
            timer = null;
            fn.apply(lastThis, lastArgs);
            lastArgs = null;
            lastThis = null;
        }
    };

    return debounced;
}

/**
 * 将浏览器像素坐标换算为归一化设备坐标 NDC (x/y 范围 [-1, 1])
 * @param {number} clientX pointer.clientX
 * @param {number} clientY pointer.clientY
 * @param {HTMLElement} target 用于计算相对左上角的目标元素
 * @returns {{x:number, y:number}}
 */
export function toNDC(clientX, clientY, target) {
    const rect = target.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return { x, y };
}

/**
 * 安全地从 localStorage 读写 JSON，失败回退默认值
 */
export const storage = {
    get(key, fallback = null) {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null) return fallback;
            return JSON.parse(raw);
        } catch (err) {
            console.warn(`storage.get(${key}) failed:`, err);
            return fallback;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (err) {
            console.warn(`storage.set(${key}) failed:`, err);
            return false;
        }
    },
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (err) {
            return false;
        }
    }
};

/**
 * 复制文本到剪贴板（带回退），返回是否成功
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (err) {
        // 回退到 execCommand
    }
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch (err) {
        return false;
    }
}

/**
 * 判断当前是否为触控优先环境
 */
export function isCoarsePointer() {
    return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
}