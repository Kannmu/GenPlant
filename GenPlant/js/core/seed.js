/**
 * 紧凑且可向后兼容的种子/花园编解码。
 *
 * G2 将 baseSeed 和 17 个量化参数直接位打包，再使用 base64url 表示。
 * 参数仍沿用 G1 的 1000 档精度，因此 G1 -> G2 不会引入额外损失。
 * P2 对重复植物使用字典，只为每个实例保存字典索引与变换。
 */

import { SEED_SCHEMA, GENERATOR_CONFIG } from '../config/constants.js';
import { DEFAULT_PARAMS, SLIDERS } from '../state/defaults.js';
import { clamp } from '../util/dom.js';

const QUANT = 1000;
const SEED_BITS = 34;
const PARAM_BITS = 10;
const STATE_DATA_BITS = SEED_BITS + SLIDERS.length * PARAM_BITS;
const STATE_DATA_BYTES = Math.ceil(STATE_DATA_BITS / 8);
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const GARDEN_COUNT_BITS = 6;
const GARDEN_MAX_ITEMS = (1 << GARDEN_COUNT_BITS) - 1;
const GARDEN_POSITION_BITS = 15;
const GARDEN_POSITION_OFFSET = 1 << (GARDEN_POSITION_BITS - 1);
const GARDEN_ROTATION_BITS = 13;
const GARDEN_ROTATION_SCALE = 1000;

export function encodeState({ baseSeed, params }) {
    return encodePackedState(quantizeState({ baseSeed, params }));
}

export function decodeState(str) {
    if (str == null) return fallbackState();
    const trimmed = String(str).trim();

    if (/^-?\d+$/.test(trimmed)) {
        return { baseSeed: clampSeed(Number(trimmed)), params: { ...DEFAULT_PARAMS } };
    }

    if (trimmed.startsWith(`${SEED_SCHEMA.PREFIX}-`)) {
        return decodeCompactState(trimmed) || fallbackState();
    }

    if (trimmed.startsWith(`${SEED_SCHEMA.LEGACY_PREFIX}-`)) {
        return decodeLegacyState(trimmed);
    }

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
        return { baseSeed: clampSeed(numeric), params: { ...DEFAULT_PARAMS } };
    }
    return fallbackState();
}

export function isEncodedState(value) {
    const text = String(value || '');
    return text.startsWith(`${SEED_SCHEMA.PREFIX}-`) || text.startsWith(`${SEED_SCHEMA.LEGACY_PREFIX}-`);
}

export function encodeGarden(garden) {
    if (!Array.isArray(garden) || garden.length === 0) return '';

    const items = garden.slice(0, GARDEN_MAX_ITEMS).map(item => {
        const state = decodeState(item.seed);
        const seed = encodeState(state);
        return {
            seed,
            packed: quantizeState(state),
            x: encodePosition(item.x),
            z: encodePosition(item.z),
            rotation: encodeRotation(item.rotationY)
        };
    });

    const dictionary = [];
    const dictionaryIndex = new Map();
    for (const item of items) {
        if (dictionaryIndex.has(item.seed)) continue;
        dictionaryIndex.set(item.seed, dictionary.length);
        dictionary.push(item.packed);
    }

    const writer = new BitWriter();
    writer.write(items.length, GARDEN_COUNT_BITS);
    writer.write(dictionary.length, GARDEN_COUNT_BITS);
    for (const packed of dictionary) writePackedState(writer, packed);
    for (const item of items) {
        writer.write(dictionaryIndex.get(item.seed), GARDEN_COUNT_BITS);
        writer.write(item.x, GARDEN_POSITION_BITS);
        writer.write(item.z, GARDEN_POSITION_BITS);
        writer.write(item.rotation, GARDEN_ROTATION_BITS);
    }

    return `${SEED_SCHEMA.GARDEN_PREFIX}-${bytesToBase64Url(withChecksum(writer.finish()))}`;
}

export function decodeGarden(str) {
    if (!str || typeof str !== 'string') return [];
    const trimmed = str.trim();
    if (trimmed.startsWith(`${SEED_SCHEMA.GARDEN_PREFIX}-`)) {
        return decodeCompactGarden(trimmed);
    }
    if (trimmed.startsWith(`${SEED_SCHEMA.LEGACY_GARDEN_PREFIX}-`)) {
        return decodeLegacyGarden(trimmed);
    }
    return [];
}

function encodePackedState(packed) {
    const writer = new BitWriter();
    writePackedState(writer, packed);
    const data = writer.finish();
    return `${SEED_SCHEMA.PREFIX}-${bytesToBase64Url(withChecksum(data))}`;
}

function decodeCompactState(text) {
    const encoded = text.slice(SEED_SCHEMA.PREFIX.length + 1);
    const checked = stripValidChecksum(base64UrlToBytes(encoded));
    if (!checked || checked.length !== STATE_DATA_BYTES) return null;
    const packed = readPackedState(new BitReader(checked));
    return packed ? expandPackedState(packed) : null;
}

function decodeCompactGarden(text) {
    const encoded = text.slice(SEED_SCHEMA.GARDEN_PREFIX.length + 1);
    const data = stripValidChecksum(base64UrlToBytes(encoded));
    if (!data) return [];

    const reader = new BitReader(data);
    const count = reader.readNumber(GARDEN_COUNT_BITS);
    const dictionaryCount = reader.readNumber(GARDEN_COUNT_BITS);
    if (count == null || dictionaryCount == null || count > GARDEN_MAX_ITEMS || dictionaryCount > count) return [];
    if (count > 0 && dictionaryCount === 0) return [];

    const dictionary = [];
    for (let i = 0; i < dictionaryCount; i++) {
        const packed = readPackedState(reader);
        if (!packed) return [];
        dictionary.push(encodePackedState(packed));
    }

    const garden = [];
    for (let i = 0; i < count; i++) {
        const seedIndex = reader.readNumber(GARDEN_COUNT_BITS);
        const x = reader.readNumber(GARDEN_POSITION_BITS);
        const z = reader.readNumber(GARDEN_POSITION_BITS);
        const rotation = reader.readNumber(GARDEN_ROTATION_BITS);
        if (seedIndex == null || x == null || z == null || rotation == null || seedIndex >= dictionary.length) return [];
        garden.push({
            seed: dictionary[seedIndex],
            x: (x - GARDEN_POSITION_OFFSET) / 100,
            z: (z - GARDEN_POSITION_OFFSET) / 100,
            rotationY: rotation / GARDEN_ROTATION_SCALE
        });
    }
    return garden;
}

function quantizeState({ baseSeed, params }) {
    const seed = clampSeed(baseSeed);
    const values = SLIDERS.map(meta => {
        const numeric = Number(params?.[meta.key]);
        const fallback = Number.isFinite(Number(meta.default)) ? Number(meta.default) : Number(DEFAULT_PARAMS[meta.key]);
        const value = clamp(Number.isFinite(numeric) ? numeric : fallback, meta.min, meta.max);
        return Math.round(((value - meta.min) / (meta.max - meta.min)) * (QUANT - 1));
    });
    return { baseSeed: seed, values };
}

function expandPackedState({ baseSeed, values }) {
    const params = { ...DEFAULT_PARAMS };
    for (let i = 0; i < SLIDERS.length; i++) {
        const meta = SLIDERS[i];
        const scaled = values[i];
        params[meta.key] = clamp(meta.min + (scaled / (QUANT - 1)) * (meta.max - meta.min), meta.min, meta.max);
    }
    return { baseSeed: clampSeed(baseSeed), params };
}

function writePackedState(writer, packed) {
    writer.write(packed.baseSeed, SEED_BITS);
    for (const value of packed.values) writer.write(value, PARAM_BITS);
}

function readPackedState(reader) {
    const baseSeed = reader.readNumber(SEED_BITS);
    if (baseSeed == null) return null;
    const values = [];
    for (let i = 0; i < SLIDERS.length; i++) {
        const value = reader.readNumber(PARAM_BITS);
        if (value == null || value >= QUANT) return null;
        values.push(value);
    }
    return { baseSeed: clampSeed(baseSeed), values };
}

function decodeLegacyState(text) {
    const body = text.slice(SEED_SCHEMA.LEGACY_PREFIX.length + 1);
    const tokens = body.split('-');
    const baseSeed = clampSeed(parseInt36(tokens[1]) ?? randomizeBaseSeed());
    const params = { ...DEFAULT_PARAMS };
    for (let i = 0; i < SLIDERS.length; i++) {
        const meta = SLIDERS[i];
        const scaled = parseInt36(tokens[i + 2]);
        if (scaled == null || scaled < 0) continue;
        params[meta.key] = clamp(meta.min + (scaled / (QUANT - 1)) * (meta.max - meta.min), meta.min, meta.max);
    }
    return { baseSeed, params };
}

function decodeLegacyGarden(text) {
    const body = text.slice(SEED_SCHEMA.LEGACY_GARDEN_PREFIX.length + 1);
    return body.split('|').map(item => {
        const parts = item.split('.');
        if (parts.length < 4) return null;
        const seed = parts.slice(0, parts.length - 3).join('.');
        const xs = parseInt(parts[parts.length - 3], 36);
        const zs = parseInt(parts[parts.length - 2], 36);
        const rs = parseInt(parts[parts.length - 1], 36);
        if (!seed || Number.isNaN(xs) || Number.isNaN(zs) || Number.isNaN(rs)) return null;
        return { seed, x: (xs - 32768) / 100, z: (zs - 32768) / 100, rotationY: rs / 1000 };
    }).filter(Boolean);
}

function encodePosition(value) {
    const min = -GARDEN_POSITION_OFFSET;
    const max = GARDEN_POSITION_OFFSET - 1;
    return clamp(Math.round((Number(value) || 0) * 100), min, max) + GARDEN_POSITION_OFFSET;
}

function encodeRotation(value) {
    const fullTurn = Math.PI * 2;
    const normalized = ((Number(value) || 0) % fullTurn + fullTurn) % fullTurn;
    return clamp(Math.round(normalized * GARDEN_ROTATION_SCALE), 0, (1 << GARDEN_ROTATION_BITS) - 1);
}

function clampSeed(value) {
    return Math.floor(clamp(Number(value) || GENERATOR_CONFIG.SEED.MIN_VALUE,
        GENERATOR_CONFIG.SEED.MIN_VALUE, GENERATOR_CONFIG.SEED.MAX_VALUE));
}

function fallbackState() {
    return { baseSeed: randomizeBaseSeed(), params: { ...DEFAULT_PARAMS } };
}

function randomizeBaseSeed() {
    const { MIN_VALUE, MAX_VALUE } = GENERATOR_CONFIG.SEED;
    return Math.floor(Math.random() * (MAX_VALUE - MIN_VALUE + 1)) + MIN_VALUE;
}

function parseInt36(value) {
    if (!value || !/^[0-9a-z]+$/i.test(value)) return null;
    const parsed = parseInt(value, 36);
    return Number.isFinite(parsed) ? parsed : null;
}

class BitWriter {
    constructor() {
        this.bytes = [];
        this.current = 0;
        this.used = 0;
    }

    write(value, width) {
        const numeric = BigInt(value);
        if (numeric < 0n || numeric >= (1n << BigInt(width))) throw new RangeError('bit field out of range');
        for (let bit = width - 1; bit >= 0; bit--) {
            this.current = (this.current << 1) | Number((numeric >> BigInt(bit)) & 1n);
            this.used++;
            if (this.used === 8) {
                this.bytes.push(this.current);
                this.current = 0;
                this.used = 0;
            }
        }
    }

    finish() {
        if (this.used > 0) this.bytes.push(this.current << (8 - this.used));
        return Uint8Array.from(this.bytes);
    }
}

class BitReader {
    constructor(bytes) {
        this.bytes = bytes;
        this.offset = 0;
    }

    readNumber(width) {
        if (this.offset + width > this.bytes.length * 8) return null;
        let value = 0n;
        for (let i = 0; i < width; i++) {
            const byte = this.bytes[this.offset >> 3];
            const bit = (byte >> (7 - (this.offset & 7))) & 1;
            value = (value << 1n) | BigInt(bit);
            this.offset++;
        }
        return Number(value);
    }
}

function withChecksum(data) {
    const result = new Uint8Array(data.length + 1);
    result.set(data);
    result[data.length] = crc8(data);
    return result;
}

function stripValidChecksum(bytes) {
    if (!bytes || bytes.length < 2) return null;
    const data = bytes.slice(0, -1);
    return crc8(data) === bytes[bytes.length - 1] ? data : null;
}

function crc8(bytes) {
    let crc = 0xa7;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) {
            crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
        }
    }
    return crc;
}

function bytesToBase64Url(bytes) {
    let output = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const a = bytes[i];
        const hasB = i + 1 < bytes.length;
        const hasC = i + 2 < bytes.length;
        const b = hasB ? bytes[i + 1] : 0;
        const c = hasC ? bytes[i + 2] : 0;
        output += BASE64URL[a >> 2];
        output += BASE64URL[((a & 3) << 4) | (b >> 4)];
        if (hasB) output += BASE64URL[((b & 15) << 2) | (c >> 6)];
        if (hasC) output += BASE64URL[c & 63];
    }
    return output;
}

function base64UrlToBytes(text) {
    if (!text || !/^[A-Za-z0-9_-]+$/.test(text) || text.length % 4 === 1) return null;
    const bytes = [];
    let buffer = 0;
    let bits = 0;
    for (const char of text) {
        const value = BASE64URL.indexOf(char);
        if (value < 0) return null;
        buffer = (buffer << 6) | value;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            bytes.push((buffer >> bits) & 0xff);
            buffer &= (1 << bits) - 1;
        }
    }
    if (bits > 0 && buffer !== 0) return null;
    return Uint8Array.from(bytes);
}
