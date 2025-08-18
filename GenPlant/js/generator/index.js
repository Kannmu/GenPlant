import * as THREE from "three";

import {createParameters} from './parameters.js'
import {createStructure} from './structure.js'
import {createGeometry} from './geometry.js'
import {applyMaterial} from './material.js'


export function generate(seed){
    let parameters, structure, geometries;

    let plant = new THREE.Group();

    // Create Parameters
    parameters = createParameters(seed);
    console.log("Generated Parameters:",parameters);

    // Create Structure
    structure = createStructure(parameters);
    console.log("Generated Structure:",structure);

    // Create Geometry
    geometries = createGeometry(parameters, structure);
    console.log("Geometry Created");


    // Create Material
    plant = applyMaterial(parameters, structure, geometries);
    console.log("Material Applied");

    return plant;
}



