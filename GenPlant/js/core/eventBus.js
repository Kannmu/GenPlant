/**
 * 极简事件总线
 * 用于模块间解耦通信，避免 store 与渲染/交互模块直接互相引用
 */

export function createEventBus() {
    const listeners = new Map();

    return {
        on(event, handler) {
            if (typeof handler !== 'function') return () => {};
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event).add(handler);
            return () => this.off(event, handler);
        },
        off(event, handler) {
            const set = listeners.get(event);
            if (set) set.delete(handler);
        },
        emit(event, payload) {
            const set = listeners.get(event);
            if (!set) return;
            // 拷贝一份以避免在回调中取消订阅导致迭代错误
            for (const handler of [...set]) {
                try {
                    handler(payload);
                } catch (err) {
                    console.error(`eventBus handler for "${event}" threw:`, err);
                }
            }
        },
        clear() {
            listeners.clear();
        }
    };
}