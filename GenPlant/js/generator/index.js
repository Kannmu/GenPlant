import * as THREE from "three";

import {createParameters} from './parameters.js'
import {createStructure} from './structure.js'
import {createGeometry} from './geometry.js'


export function generate(seed){
    let parameters, structure, geometry;

    let plant = new THREE.Group();

    // Create Parameters
    parameters = createParameters(seed);
    console.log("Generated Parameters:",parameters);

    // Create Structure
    structure = createStructure(parameters);
    console.log("Generated Structure:",structure);

    // Create Geometry
    geometry = createGeometry(parameters, structure);
    console.log("Generated Geometry:");
    plant.add(geometry);


    return plant;
}



