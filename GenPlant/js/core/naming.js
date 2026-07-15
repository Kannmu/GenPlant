const PREFIXES = ['雾', '青', '澄', '风', '月', '雨', '苔', '星', '野', '晨', '雪', '霞'];
const FORMS = ['羽', '冠', '铃', '枝', '珊', '灯', '塔', '芽', '岚', '弦'];
const SPECIES = ['木', '草', '花', '藤', '树'];

export function describePlant(baseSeed, params = {}) {
    const seed = Math.max(1, Math.floor(Number(baseSeed) || 1));
    const a = hash(seed);
    const b = hash(a ^ 0x9e3779b9);
    const c = hash(b ^ 0x85ebca6b);
    const name = `${PREFIXES[a % PREFIXES.length]}${FORMS[b % FORMS.length]}${SPECIES[c % SPECIES.length]}`;
    const traits = [
        postureTrait(params.gravitropism),
        foliageTrait(params.leafiness),
        bloomTrait(params.bloom)
    ];
    return {
        name,
        traits: traits.join(' · '),
        specimen: `SPECIMEN ${String(seed % 1000).padStart(3, '0')}`
    };
}

function postureTrait(value = 0.5) {
    if (value < 0.1) return '垂生';
    if (value > 0.72) return '向光';
    return '舒展';
}

function foliageTrait(value = 0.64) {
    if (value < 0.34) return '疏叶';
    if (value > 0.76) return '繁叶';
    return '轻羽';
}

function bloomTrait(value = 0.28) {
    if (value < 0.12) return '素枝';
    if (value > 0.68) return '盛花';
    return '初花';
}

function hash(value) {
    let x = Number(value) >>> 0;
    x ^= x >>> 16;
    x = Math.imul(x, 0x7feb352d);
    x ^= x >>> 15;
    x = Math.imul(x, 0x846ca68b);
    return (x ^ (x >>> 16)) >>> 0;
}
