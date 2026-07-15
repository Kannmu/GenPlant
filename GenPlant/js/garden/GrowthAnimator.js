import { GARDEN_CONFIG } from '../config/constants.js';
import { smootherstep } from '../util/math.js';

/**
 * 生长动画驱动器：放在 Engine.updater 队列里，每帧推进所有 growing 实例。
 * 放置时实例从 0 渐显到 1（scale 0 -> 当前缩放），用 smootherstep 缓动。
 *
 * 这里用「缩放 key」实现：记录最终缩放 finalScale，生长时用 growth * finalScale。
 * 由于 PlantInstance.normalize 已经把 scale 设好，我们把 finalScale 记录在 userData，
 * 生长期间临时改 group.scale.scaleScalar(factor)。
 */
export function createGrowthAnimator() {
    const active = new Set();

    function start(instance) {
        instance.growth = 0;
        instance.growing = true;
        if (!instance.group.userData.finalScale) {
            instance.group.userData.finalScale = instance.group.scale.x || 1;
        }
        instance.group.scale.setScalar(0.0001); // 从接近 0 开始
        active.add(instance);
    }

    function update(dt) {
        if (active.size === 0) return;
        const durationSec = GARDEN_CONFIG.GROWTH_DURATION_MS / 1000;
        for (const inst of [...active]) {
            if (inst.disposed || !inst.group?.parent) {
                active.delete(inst);
                continue;
            }
            inst.growth += dt / durationSec;
            const t = Math.min(1, Math.max(0, inst.growth));
            const factor = smootherstep(0, 1, t);
            const final = inst.group.userData.finalScale || 1;
            inst.group.scale.setScalar(Math.max(0.0001, factor * final));
            if (t >= 1) {
                inst.group.scale.setScalar(final);
                inst.growing = false;
                active.delete(inst);
            }
        }
    }

    function stop(instance) {
        if (instance.group?.userData.finalScale) {
            instance.group.scale.setScalar(instance.group.userData.finalScale);
        }
        instance.growing = false;
        active.delete(instance);
    }

    return { start, stop, update };
}