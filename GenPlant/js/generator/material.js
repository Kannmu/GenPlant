import * as THREE from "three";

export function applyMaterial(parameters, structure, geometries) {
    let plant = new THREE.Group();
    let material = new THREE.MeshBasicMaterial({ color: 0x9c7749, wireframe: true });

    geometries.forEach((geometry) => {
        if (geometry) {
            plant.add(new THREE.Mesh(geometry, material));
        }
    });

    return plant;
}





