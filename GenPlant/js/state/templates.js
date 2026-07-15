import { encodeState, decodeState } from '../core/seed.js';
import { describePlant } from '../core/naming.js';
import { storage } from '../util/dom.js';

const LIBRARY_KEY = 'genplant:templates:v1';
const ACTIVE_KEY = 'genplant:templates:active';
const MAX_TEMPLATES = 32;

export function createTemplateLibrary() {
    let templates = sanitizeTemplates(storage.get(LIBRARY_KEY, []));
    let activeId = storage.get(ACTIVE_KEY, null);
    const listeners = new Set();

    if (!templates.some(item => item.id === activeId)) activeId = templates[0]?.id || null;

    function list() { return templates.slice(); }
    function get(id) { return templates.find(item => item.id === id) || null; }
    function getActive() { return get(activeId); }

    function resolve(templateOrId) {
        const template = typeof templateOrId === 'string' ? get(templateOrId) : templateOrId;
        if (!template) return null;
        const decoded = decodeState(template.seed);
        return { ...template, baseSeed: decoded.baseSeed, params: decoded.params, materialStyle: 'standard' };
    }

    function save({ baseSeed, params }, id = null) {
        const seed = encodeState({ baseSeed, params });
        const description = describePlant(baseSeed, params);
        const now = Date.now();
        const existingIndex = id ? templates.findIndex(item => item.id === id) : -1;

        if (existingIndex >= 0) {
            const previous = templates[existingIndex];
            const updated = {
                ...previous,
                seed,
                name: description.name,
                traits: description.traits,
                palette: Math.round(params.palette ?? -1),
                updatedAt: now
            };
            templates.splice(existingIndex, 1);
            templates.unshift(updated);
            activeId = updated.id;
            persist();
            return updated;
        }

        const duplicate = templates.find(item => item.seed === seed);
        if (duplicate) {
            activeId = duplicate.id;
            persist();
            return duplicate;
        }

        const template = {
            id: createId(now, baseSeed),
            seed,
            name: description.name,
            traits: description.traits,
            palette: Math.round(params.palette ?? -1),
            createdAt: now,
            updatedAt: now
        };
        templates.unshift(template);
        templates = templates.slice(0, MAX_TEMPLATES);
        activeId = template.id;
        persist();
        return template;
    }

    function select(id) {
        if (!templates.some(item => item.id === id)) return null;
        activeId = id;
        persist();
        return getActive();
    }

    function remove(id) {
        const index = templates.findIndex(item => item.id === id);
        if (index < 0) return false;
        templates.splice(index, 1);
        if (activeId === id) activeId = templates[0]?.id || null;
        persist();
        return true;
    }

    function importSeeds(entries = []) {
        let changed = false;
        for (const entry of entries) {
            if (!entry?.seed || templates.some(item => item.seed === entry.seed)) continue;
            const decoded = decodeState(entry.seed);
            const description = describePlant(decoded.baseSeed, decoded.params);
            const now = Date.now() - templates.length;
            templates.push({
                id: createId(now, decoded.baseSeed),
                seed: entry.seed,
                name: description.name,
                traits: description.traits,
                palette: Math.round(decoded.params.palette ?? -1),
                createdAt: now,
                updatedAt: now
            });
            changed = true;
        }
        if (changed) {
            templates = templates.slice(0, MAX_TEMPLATES);
            if (!activeId) activeId = templates[0]?.id || null;
            persist();
        }
    }

    function subscribe(handler) {
        if (typeof handler !== 'function') return () => {};
        listeners.add(handler);
        return () => listeners.delete(handler);
    }

    function persist(notify = true) {
        storage.set(LIBRARY_KEY, templates);
        storage.set(ACTIVE_KEY, activeId);
        if (notify) {
            for (const handler of [...listeners]) handler(list(), activeId);
        }
    }

    return { list, get, getActive, resolve, save, select, remove, importSeeds, subscribe };
}

function sanitizeTemplates(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(item => item && typeof item.id === 'string' && typeof item.seed === 'string')
        .slice(0, MAX_TEMPLATES);
}

function createId(now, seed) {
    return `tpl_${now.toString(36)}_${(Number(seed) >>> 0).toString(36)}`;
}
