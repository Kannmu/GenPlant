import * as THREE from "three";
import { random, randomFloat, randomInt, choice } from '../util/random.js';
import { GEOMETRY_CONFIG } from '../config/constants.js';
import { calculateTubeSegments } from '../util/geometry.js';

// Frenet frames缓存，避免重复计算
const frenetFramesCache = new WeakMap();


export function createGeometry(parameters, structure, opts = {}) {
    const geometries = [];
    const previewScale = opts.previewQuality
        ? GEOMETRY_CONFIG.PREVIEW_SEGMENTS_SCALE
        : 1;

    function _createBranch(node, parentNode) {
        if (!node.curve) {
            for (const child of node.children) {
                _createBranch(child, node);
            }
            return;
        }

        const startRadius = node.startRadius;
        const endRadius = node.endRadius;
        const { TUBE_MESH } = GEOMETRY_CONFIG;
        const { radialSegments, tubularSegments } = calculateTubeSegments(
            startRadius,
            node.curve.getLength(),
            TUBE_MESH,
            previewScale
        );

        const meshData = generateTubeMesh(node.curve, tubularSegments, radialSegments, startRadius, endRadius);

        // 分支与父节点连接的核心逻辑
        if (parentNode && parentNode.curve && typeof node.attachmentT === 'number') {
            if (!parentNode.tubularSegments) {
                const parentSegments = calculateTubeSegments(
                    parentNode.startRadius,
                    parentNode.curve.getLength(),
                    TUBE_MESH,
                    previewScale
                );
                parentNode.tubularSegments = parentSegments.tubularSegments;
            }
            if (!parentNode.frenetFrames) {
                parentNode.frenetFrames = parentNode.curve.computeFrenetFrames(parentNode.tubularSegments, false);
            }

            const parentFrames = parentNode.frenetFrames;
            const parentTubularSegments = parentNode.tubularSegments;
            const t_parent = node.attachmentT;

            const parentPoint = parentNode.curve.getPointAt(t_parent);
            const parentRadius = THREE.MathUtils.lerp(parentNode.startRadius, parentNode.endRadius, t_parent);

            const parentFrameIndex = Math.round(t_parent * parentTubularSegments);
            const parentTangent = parentFrames.tangents[parentFrameIndex];

            const { BRANCH_STITCHING } = GEOMETRY_CONFIG;
            const transitionDistance = parentRadius * BRANCH_STITCHING.TRANSITION_DISTANCE_MULTIPLIER;

            const childBranchLength = node.curve.getLength();
            const transitionSegments = Math.min(
                tubularSegments,
                Math.max(
                    BRANCH_STITCHING.MIN_TRANSITION_SEGMENTS,
                    Math.ceil((transitionDistance / childBranchLength) * tubularSegments)
                )
            );

            const targetNormals = [];
            for (let j = 0; j <= radialSegments; j++) {
                const baseVertexIndex = j * 3;
                const baseVertex = new THREE.Vector3().fromArray(meshData.vertices, baseVertexIndex);
                const offsetVector = baseVertex.clone().sub(parentPoint);
                const tangentProjection = parentTangent.clone().multiplyScalar(offsetVector.dot(parentTangent));
                const perpendicularVector = offsetVector.clone().sub(tangentProjection);
                targetNormals.push(perpendicularVector.clone().normalize());
            }

            for (let i = 0; i < transitionSegments; i++) {
                const lerpFactor = (transitionSegments <= 1) ? 1.0 : 1.0 - (i / (transitionSegments - 1));

                const t_child = i / tubularSegments;
                const childCenterPoint = node.curve.getPointAt(t_child);
                const actualRadiusAt_i = Math.max(
                    TUBE_MESH.MIN_RADIUS,
                    THREE.MathUtils.lerp(node.startRadius, node.endRadius, t_child)
                );

                const interpolatedCenter = childCenterPoint.clone().lerp(parentPoint, lerpFactor);

                for (let j = 0; j <= radialSegments; j++) {
                    const vertexIndex = (i * (radialSegments + 1) + j) * 3;

                    const originalNormal = new THREE.Vector3().fromArray(meshData.normals, vertexIndex);
                    const targetNormal = targetNormals[j];

                    const newNormal = originalNormal.clone().lerp(targetNormal, lerpFactor).normalize();
                    newNormal.toArray(meshData.normals, vertexIndex);

                    const interpolatedRadius = THREE.MathUtils.lerp(actualRadiusAt_i, parentRadius, lerpFactor);

                    const newVertex = interpolatedCenter.clone().add(newNormal.clone().multiplyScalar(interpolatedRadius));
                    newVertex.toArray(meshData.vertices, vertexIndex);
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));

        // 顶点色：沿分支按 levelProgress 着色（浅绿梯度），交由共享材质 vertexColors 渲染
        const maxLevels = parameters.structure.branching.levels;
        const levelProgress = maxLevels > 0 ? THREE.MathUtils.clamp(node.level / maxLevels, 0, 1) : 0;
        const vertexCount = meshData.vertices.length / 3;
        const colors = new Float32Array(vertexCount * 3);
        for (let i = 0; i < vertexCount; i++) {
            // 沿管轴从段 t 做微调，使梢端更亮 —— 在 t 轴上与 levelProgress 复合
            colors[i * 3] = levelProgress;
            colors[i * 3 + 1] = levelProgress;
            colors[i * 3 + 2] = levelProgress;
        }
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        geometry.setIndex(meshData.indices);

        geometries.push({ geometry: geometry, node: node, levelProgress: levelProgress });

        for (const child of node.children) {
            _createBranch(child, node);
        }
    }

    _createBranch(structure, null);
    return geometries;
}

/**
 * Generates the vertices, normals, and indices for a tapered tube geometry along a curve.
 */
function generateTubeMesh(curve, tubularSegments, radialSegments, startRadius, endRadius) {
    const cacheKey = `${tubularSegments}`;
    let frames;

    if (frenetFramesCache.has(curve)) {
        const cachedFrames = frenetFramesCache.get(curve);
        if (cachedFrames[cacheKey]) {
            frames = cachedFrames[cacheKey];
        } else {
            frames = curve.computeFrenetFrames(tubularSegments, false);
            cachedFrames[cacheKey] = frames;
        }
    } else {
        frames = curve.computeFrenetFrames(tubularSegments, false);
        frenetFramesCache.set(curve, { [cacheKey]: frames });
    }

    const { normals: frameNormals, binormals } = frames;

    const vertices = [];
    const vertexNormals = [];
    const indices = [];

    for (let i = 0; i <= tubularSegments; i++) {
        const t = i / tubularSegments;
        const point = curve.getPointAt(t);
        const radius = Math.max(0.01, THREE.MathUtils.lerp(startRadius, endRadius, t));

        const normal = frameNormals[i];
        const binormal = binormals[i];

        for (let j = 0; j <= radialSegments; j++) {
            const angle = (j / radialSegments) * Math.PI * 2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            const vertexNormal = new THREE.Vector3(
                cos * normal.x + sin * binormal.x,
                cos * normal.y + sin * binormal.y,
                cos * normal.z + sin * binormal.z
            ).normalize();
            vertexNormals.push(vertexNormal.x, vertexNormal.y, vertexNormal.z);

            const vertex = new THREE.Vector3()
                .copy(point)
                .add(vertexNormal.clone().multiplyScalar(radius));
            vertices.push(vertex.x, vertex.y, vertex.z);
        }
    }

    for (let i = 0; i < tubularSegments; i++) {
        for (let j = 0; j < radialSegments; j++) {
            const a = i * (radialSegments + 1) + j;
            const b = a + 1;
            const c = (i + 1) * (radialSegments + 1) + j;
            const d = c + 1;
            indices.push(a, b, d);
            indices.push(a, d, c);
        }
    }

    return { vertices, normals: vertexNormals, indices };
}