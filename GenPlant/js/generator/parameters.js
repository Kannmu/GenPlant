import { init, randomFloat, randomInt, choice } from '../util/random.js';
import * as THREE from 'three';


export function createParameters(seed) {
    init(seed);
    // ['tree', 'grass', "vine", "succulent"]
    return {
        global: {
            seed: Number(seed),
        },
        archetype: {
            type: choice(['tree']),
            growthForm: randomFloat(0, 1),
            age: randomFloat(0, 1),
            scale: new THREE.Vector3(randomFloat(0.5, 1.5), randomFloat(0.5, 1.5), randomFloat(0.5, 1.5)),
        },
        environment: {
            phototropism: new THREE.Vector3(randomFloat(-1, 1), randomFloat(0.5, 1), randomFloat(-1, 1)),
            gravitropism: randomFloat(-1, 1),
            pruningFactor: randomFloat(0, 1),
            lightIntensity: randomFloat(0, 1),
            temperature: randomFloat(0, 1),
            humidity: randomFloat(0, 1),
        },
        structure:{
            trunk:{
                taper:randomFloat(0, 1),
                curviness: new THREE.Vector2(0.5, 0.1),
            },
            branching: {
                levels: randomInt(3, 7), // 最大分支深度
                // levels: 1, // 最大分支深度
                // { 最小, 最大 }
                branchesPerSplit: { min: 1, max: 3 },
                
                // { 子枝与母枝的夹角, 子枝之间的夹角 }
                splitAngleRange: {min: Math.PI/10, max: Math.PI/4}, // in radius
                
                lengthDecay: randomFloat(0.6, 0.9), // 子分支长度衰减率
                radiusDecay: randomFloat(0.6, 0.8), // 子分支半径衰减率
                curviness: new THREE.Vector2(1.5, 0.2),// (频率, 振幅)
                // { 最小, 最大 }
                rotationAngle: { min: randomFloat(0, Math.PI/2), max: randomFloat(Math.PI/2, Math.PI) }, // in radius
            },
        },
    }
}



