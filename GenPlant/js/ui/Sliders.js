import { SLIDERS } from '../state/defaults.js';
import { debounce } from '../util/dom.js';

/**
 * 滑块组件：依据 SLIDERS 元数据生成滑块，双向绑定 store.params
 *
 * - input 事件即时更新 store.params（同步，UI 即时反馈），
 *   同时把新的复合 seed 写入 seedInput 与 URL；
 * - onChange 用 onChange 来回调上层「预览重生」以防拖动期间每像素重生。
 *   上层自身用 debounce 包 onChange 即可，这里只透传。
 */
export function createSliders(containerEl, store, onChange) {
    containerEl.innerHTML = '';
    const valueEls = {};
    const sliderEls = {};

    for (const meta of SLIDERS) {
        const item = document.createElement('div');
        item.className = 'slider-item';

        const label = document.createElement('label');
        const span = document.createElement('span');
        span.textContent = meta.label;
        const val = document.createElement('span');
        val.className = 'val';
        label.appendChild(span);
        label.appendChild(val);

        const input = document.createElement('input');
        input.type = 'range';
        input.min = meta.min;
        input.max = meta.max;
        input.step = meta.step;
        input.value = store.getState().params[meta.key];
        input.setAttribute('aria-label', meta.label);

        function formatValue(v) {
            if (meta.step >= 1) return Math.round(Number(v));
            if (meta.step >= 0.05) return (Math.round(Number(v) * 100) / 100).toFixed(2);
            return (Math.round(Number(v) * 1000) / 1000).toFixed(3);
        }
        val.textContent = formatValue(input.value);

        input.addEventListener('input', () => {
            val.textContent = formatValue(input.value);
            store.patchParams({ [meta.key]: Number(input.value) });
            if (typeof onChange === 'function') onChange(meta.key);
        });

        item.appendChild(label);
        item.appendChild(input);
        containerEl.appendChild(item);

        valueEls[meta.key] = val;
        sliderEls[meta.key] = input;
    }

    return {
        /** 用 store 当前参数刷新所有滑块 UI */
        refreshFromStore() {
            const params = store.getState().params;
            for (const meta of SLIDERS) {
                const el = sliderEls[meta.key];
                if (el) el.value = params[meta.key];
                const ve = valueEls[meta.key];
                if (ve) {
                    if (meta.step >= 1) ve.textContent = Math.round(params[meta.key]);
                    else if (meta.step >= 0.05) ve.textContent = (Math.round(params[meta.key] * 100) / 100).toFixed(2);
                    else ve.textContent = (Math.round(params[meta.key] * 1000) / 1000).toFixed(3);
                }
            }
        }
    };
}