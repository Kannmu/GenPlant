import * as THREE from "three";
import { random, randomFloat, randomInt, choice } from '../util/random.js';


export function createGeometry(parameters, structure) {
    const geometries = [];

    function _createBranch(node, startRadius) {
        const branchLength = node.length;

        // const startRadius = node.radius;
        const endRadius = startRadius * parameters.structure.branching.radiusDecay;

        const finalStartRadius = Math.max(0.05, startRadius);
        const finalEndRadius = Math.max(0.05, endRadius);

        const cylinder = new THREE.CylinderGeometry(
            finalEndRadius,   // radiusTop
            finalStartRadius, // radiusBottom
            branchLength,     // height
            10                 // radialSegments
        );

        // Create a transformation matrix to position and orient the cylinder.
        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const upVector = new THREE.Vector3(0, 1, 0); // Default orientation of CylinderGeometry

        // Calculate the rotation required to align the cylinder with the branch's orientation.
        quaternion.setFromUnitVectors(upVector, node.orientation.clone().normalize());

        // Calculate the world position of the center of the cylinder.
        // It's the node's base position plus half the length along its orientation vector.
        const centerPosition = new THREE.Vector3()
            .copy(node.position)
            .add(node.orientation.clone().multiplyScalar(branchLength / 2));

        // Compose the rotation and translation into the single matrix.
        matrix.makeRotationFromQuaternion(quaternion);
        matrix.setPosition(centerPosition);

        // Apply the transformation to the geometry.
        cylinder.applyMatrix4(matrix);

        geometries.push(cylinder);

        for (const child of node.children) {
            _createBranch(child, finalEndRadius);
        }
    }
    _createBranch(structure,structure.radius);
    return geometries;
}


export function mergeGeometries(geometries, threshold = 0.0001) {
    const mergedGeometry = new THREE.BufferGeometry();

    const finalPositions = [];
    const finalNormals = [];
    const finalUvs = [];
    const finalIndices = [];

    const vertexMap = new Map(); // Maps a quantized vertex position to its new index
    // Calculate precision from threshold to create a hash key
    const precision = Math.pow(10, -Math.log10(threshold));

    for (const geometry of geometries) {
        // Ensure the geometry is indexed and has positions
        if (!geometry.index || !geometry.attributes.position) {
            geometry.dispose();
            continue;
        }

        const positions = geometry.attributes.position.array;
        const normals = geometry.attributes.normal ? geometry.attributes.normal.array : null;
        const uvs = geometry.attributes.uv ? geometry.attributes.uv.array : null;
        const indices = geometry.index.array;

        // Iterate over the indices to process each vertex of each face
        for (let i = 0; i < indices.length; i++) {
            const index = indices[i];
            const pIndex = index * 3;
            const vIndex = index * 2;

            const x = positions[pIndex];
            const y = positions[pIndex + 1];
            const z = positions[pIndex + 2];

            // Create a quantized key for the vertex position
            const key = `${Math.round(x * precision)},${Math.round(y * precision)},${Math.round(z * precision)}`;

            if (vertexMap.has(key)) {
                // A vertex at this position has already been processed.
                // Reuse its index for the new face.
                finalIndices.push(vertexMap.get(key));
            } else {
                // This is a new, unique vertex.
                const newIndex = finalPositions.length / 3;
                finalPositions.push(x, y, z);

                if (normals) {
                    finalNormals.push(normals[pIndex], normals[pIndex + 1], normals[pIndex + 2]);
                }
                if (uvs) {
                    finalUvs.push(uvs[vIndex], uvs[vIndex + 1]);
                }

                // Store the new index in the map and use it for the face.
                vertexMap.set(key, newIndex);
                finalIndices.push(newIndex);
            }
        }

        // Dispose of the original geometry to free up memory
        geometry.dispose();
    }

    mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(finalPositions, 3));

    if (finalNormals.length > 0) {
        mergedGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(finalNormals, 3));
    }

    if (finalUvs.length > 0) {
        mergedGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(finalUvs, 2));
    }

    mergedGeometry.setIndex(finalIndices);

    // IMPORTANT: Recompute normals after welding to smooth the seams.
    // This averages the normals of faces sharing a now-merged vertex.
    if (finalNormals.length === 0 && finalPositions.length > 0) {
        mergedGeometry.computeVertexNormals();
    }


    return mergedGeometry;
}