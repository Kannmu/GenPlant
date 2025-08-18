let _randomFunc;

/**
 * Creates a pseudo-random number generator using the mulberry32 algorithm.
 * @param {number} a - The seed.
 * @returns {function(): number} A function that returns a random float between 0 and 1.
 */
function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        var t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

export function init(seed) {
    _randomFunc = mulberry32(seed);
}

export function random() {
    if (!_randomFunc) {
        throw new Error("Random number generator not initialized. Call init(seed) first.");
    }
    return _randomFunc();
}


export function randomFloat(min, max) {
    return random() * (max - min) + min;
}

export function randomInt(min, max) {
    return Math.floor(random() * (max - min + 1)) + min;
}

export function choice(arr) {
    if (!arr || arr.length === 0) {
        return undefined;
    }
    return arr[Math.floor(random() * arr.length)];
}