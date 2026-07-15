import * as THREE from "https://esm.sh/three";
import { GARDEN_CONFIG } from '../config/constants.js';

/**
 * 选中高亮：为被选中植物做轻微缩放脉冲 + 边缘 emissive 提亮。
 * 实现方式：给选中 group 无限循环一个 1.0 -> HIGHLIGHT_SCALE 往返的 scale 乘数（叠加在生长 finalScale 上）。
 */
export function createSelection() {
    let current = null;
    let pulseT = 0;

    function select(instance) {
        if (current === instance) return current;
        clearCurrent();
        if (!instance) return null;
        current = instance;
        pulseT = 0;
        return current;
    }

    function clear() {
        clearCurrent();
    }

    function clearCurrent() {
        if (current && current.group && !current.disposed) {
            const f = current.group.userData.finalScale || current.group.scale.x || 1;
            current.group.scale.setScalar(f);
        }
        current = null;
    }

    function get() { return current; }

    function update(dt) {
        if (!current || current.disposed || !current.group?.parent || current.growing) return;
        pulseT += dt;
        const pulse = 0.5 * (1 + Math.sin(pulseT * 4)); // 0..1
        const factor = 1 + (GARDEN_CONFIG.HIGHLIGHT_SCALE - 1) * pulse;
        const f = current.group.userData.finalScale || 1;
        current.group.scale.setScalar(f * factor);
    }

    return { select, clear, get, update };
}