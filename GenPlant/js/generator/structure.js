import * as THREE from "three";
import {random, randomFloat, randomInt, choice } from '../util/random.js';

export function createStructure(parameters) {
    let structure;

    switch (parameters.archetype.type) {
        case "tree":
            structure = generateTreeStructure(parameters);
            break;
        default:
            break;
    }

    return structure;
}


function generateTreeStructure(parameters) {

    let nodeCounter = 0;

    const root = {
        id: nodeCounter++,
        parentID: null,
        level: 0,
        position: new THREE.Vector3(0, 0, 0),
        orientation: new THREE.Vector3(randomFloat(-0.5, 0.5), randomFloat(-1, 1), randomFloat(-0.5, 0.5)),
        length: randomFloat(0.2, 2),
        children: [],
        attachments: []
    };

    function _expandNode(parentNode, currentLevel) {
        // 1. Stop condition: Check if max depth is reached.
        const maxLevels = parameters.structure.branching.levels;
        if (currentLevel >= maxLevels) {
            return;
        }

        // 2. 应用规则: 决定是否要修剪这个分支
        // (为了简化，我们暂时不在这里加修剪，但这是可以加的地方)

        // 3. 决定分支数量
        const { min, max } = parameters.structure.branching.branchesPerSplit;
        const numBranches = randomInt(min, max);

        const parentOrientation = parentNode.orientation.clone();

        // 4. 创建子节点并递归
        for (let i = 0; i < numBranches; i++) {
            const { splitAngle, rotationAngle } = parameters.structure.branching;

            const newOrientation = calculateChildOrientation(parentOrientation, splitAngle, rotationAngle);
            const newLength = calculateChildLength(parentNode.length, parameters.structure.branching.lengthDecay);
            const newPosition = calculateChildPosition(parentNode.position, parentOrientation, parentNode.length);

            const childNode = {
                id: nodeCounter++,
                parentID: parentNode.id,
                level: currentLevel + 1,
                position: newPosition,
                orientation: newOrientation,
                length: newLength,
                children: [],
                attachments: []
            };
            parentNode.children.push(childNode);

            // 递归调用
            _expandNode(childNode, currentLevel + 1);
        }
    }

    _expandNode(root, 0);

    return root
}


function calculateChildOrientation(parentOrientation, splitAngleRange, rotationAngleRange) {
    const splitAngle = randomFloat(splitAngleRange.min, splitAngleRange.max);
    const rotationAngle = randomFloat(rotationAngleRange.min, rotationAngleRange.max);

    let newOrientation = parentOrientation.clone();

    // To create a split, we need to rotate the vector. The axis of rotation should be perpendicular to the vector itself.
    // We create a random perpendicular axis.
    const randomVec = new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize();
    const rotationAxis = new THREE.Vector3().crossVectors(parentOrientation, randomVec).normalize();

    // Fallback for the rare case where the random vector is parallel to the orientation vector.
    if (rotationAxis.lengthSq() < 0.001) {
        rotationAxis.set(1, 0, 0);
    }

    // First, apply the split angle rotation.
    const splitQuaternion = new THREE.Quaternion().setFromAxisAngle(rotationAxis, THREE.MathUtils.degToRad(splitAngle));
    newOrientation.applyQuaternion(splitQuaternion);

    // Second, apply the rotation around the original parent axis to distribute branches three-dimensionally.
    const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(parentOrientation, THREE.MathUtils.degToRad(rotationAngle));
    newOrientation.applyQuaternion(rotationQuaternion);

    return newOrientation;
}

function calculateChildLength(parentLength, lengthDecay) {
    return parentLength * lengthDecay * randomFloat(0.5, 1.5);
}

function calculateChildPosition(parentPosition, parentOrientation, parentLength) {
    return new THREE.Vector3()
        .copy(parentPosition)
        .add(parentOrientation.clone().multiplyScalar(parentLength));
}











