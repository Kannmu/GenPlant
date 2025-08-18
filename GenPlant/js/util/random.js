import { seededRandom } from "three/src/math/MathUtils.js";

let randomSeed;

export function init(seed){
    randomSeed = seed;
}

export function random() {
    return seededRandom(randomSeed);
}


export function randomFloat(min, max) {
    return seededRandom(randomSeed) * (max - min) + min;
}

export function randomInt(min, max) {
    return Math.floor(seededRandom(randomSeed) * (max - min + 1)) + min;
}

export function choice(arr){
    return arr[Math.floor(seededRandom(randomSeed) * arr.length)];
}




