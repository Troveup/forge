
var THREE = require('custom-three');
var Util = require('forge/Util');

var exporter = new THREE.OBJExporter();
var Mesh = module.exports;

/* morph weight - the influence of the morph, where 1 corresponds to the deformed shape key and 0
 * is the basis mesh. Interpolating values between 0 and 1 allows us to determine a smooth
 * transformation between the basis and deformed mesh, and going outside of this range allows us to
 * accentuate or negate the deformation
 *
 * graph value - a value is usually normalized to the range [0,1] before being filtered to
 * subsequent nodes. These normalized values will be remapped to a morph weights, where values in
 * the range [0,1] map to weights [minWeight, maxWeight]
 *
 * remapping - a slider all the way to left corresponds to value 0, but may correspond to heigher weight if the operator has a minWeight above 0
 */

Mesh.create = function(meshSpec){
    var that = {
        threeMesh: null,
        cachedWeights: null,
        spec: meshSpec,
        operators: {},
        positionArray: null,
        registerOperator: registerOperator,
        initGeometry: initGeometry,
        resetGeometryFromSpec: resetGeometryFromSpec,
        applyWeightDeltas: applyWeightDeltas,
        setSmartMorphWeights: setSmartMorphWeights
    };

    that.initGeometry();
    that.vertToIndices = generateMappingToExpandedIndices(that.spec.vertices.length / 3, that.spec.triangles);

    that.id = meshSpec.id;
    return that;
};

function registerOperator(operator) {
    this.operators[operator.id] = operator;
}

// multi-threaded arch notes --
// main: detect control update, send operator parameters to worker
// worker: treats geometry in worker as cache, reload vertex array data from spec when necessary
// worker: receive morph update request, update buffergeometry from data, calculate normals
// worker: transfer arrays to main process
// main: update position and normal attributes of rendered buffergeo

/* Calculate the volume of mesh defined by the passed mesh's geometry
 * Optionally takes a scale factor, defaulting to 1 aka no scaling, by which each axis would be
 * scaled before measuring the volume of the resulting mesh.
 * Assumes the winding order of the faces is consistent, no internal faces, no gaps in the
 * surface, and no intersections to get an accurate volume.
 **/
Mesh.calcThreeVolume = function(mesh) {
    var totalVolume = 0;

    var vertexAttribute = mesh.geometry.attributes.position;
    var faceCount = vertexAttribute.count / 3;

    var v1 = new THREE.Vector3();
    var v2 = new THREE.Vector3();
    var v3 = new THREE.Vector3();
    var c = new THREE.Vector3();
    for (var i = 0; i < faceCount; i++) {
        var offset = 9 * i;
        v1.set(vertexAttribute.array[ offset ], vertexAttribute.array[offset+1], vertexAttribute.array[offset+2]);
        v2.set(vertexAttribute.array[offset+3], vertexAttribute.array[offset+4], vertexAttribute.array[offset+5]);
        v3.set(vertexAttribute.array[offset+6], vertexAttribute.array[offset+7], vertexAttribute.array[offset+8]);
        totalVolume += c.crossVectors( v1, v2 ).dot(v3);
    }

    var vol = Math.abs(totalVolume / 6.0);
    return vol;
};

// could make this function much faster in exchange for expanding all morph targets (large memory requirement)
function applyWeightDeltas(weightHash) {
    var that = this;
    var i, j, k;

    var positionBuffer = that.threeMesh.geometry.attributes.position.array;

    Object.keys(that.operators).map(function(operatorID) {
        var delta = weightHash[operatorID];
        if (!delta) { // only safe because falsy numbers shouldn't cause a change
            return;
        }
        var operator = that.operators[operatorID];
        var len = operator.parameters.modifiedCount;
        for (i = 0; i < len;  i++) {
            k = i * 3;
            var dx = operator.parameters.displacements[k] * delta;
            var dy = operator.parameters.displacements[k+1] * delta;
            var dz = operator.parameters.displacements[k+2] * delta;
            var vertexIndex = operator.parameters.indices[i];

            // must update multiple vectors because vertices shared by multiple faces are split
            var expandedIndices = that.vertToIndices[vertexIndex];
            for (j = 0; j < expandedIndices.length; j++) {
                var offset = expandedIndices[j] * 3;
                positionBuffer[ offset ] += dx;
                positionBuffer[offset+1] += dy;
                positionBuffer[offset+2] += dz;
            }
        }
    });
    that.threeMesh.geometry.attributes.position.needsUpdate = true;
    that.threeMesh.geometry.computeVertexNormals();
}

function indexedTrisToVertexData(triangles, vertices) {
    var expandedCount = triangles.length * 3;
    var vertexArray = new Float32Array( expandedCount );
    var i, j, offset = 0;

    for (i = 0; i < triangles.length; i++) {
        j = triangles[i] * 3;
        vertexArray[offset++] = vertices[j];
        vertexArray[offset++] = vertices[j+1];
        vertexArray[offset++] = vertices[j+2];
    }
    return vertexArray;
}

// mapping for each vertex index (the array index) to the list of item indices in the expanded vertex positions array
// used to expand morph target influences
// numVertices only necessary for preallocation of array
function generateMappingToExpandedIndices(numVertices, triangles) {
    var vertToIndices = new Array(numVertices)
    var triElems = triangles.length;

    var i;
    for (i = 0; i < numVertices; i++) {
        vertToIndices[i] = [];
    }
    for (i = 0; i < triElems; i++) {
        vertToIndices[triangles[i]].push(i);
    }
    return vertToIndices;
}

function initGeometry() {
    var that = this;

    var positionArray = indexedTrisToVertexData(that.spec.triangles, that.spec.vertices);
    var geometry = new THREE.BufferGeometry();
    geometry.addAttribute( 'position', new THREE.BufferAttribute( positionArray, 3 ) );
    geometry.computeVertexNormals();

    that.threeMesh = new THREE.Mesh( geometry );
}

function resetGeometryFromSpec() {
    var that = this;

    if (!that.threeMesh) {
        console.warn("resetting before threeMesh parsed, aborting");
        return;
    }

    var geometry = that.threeMesh.geometry;
    var newArray = indexedTrisToVertexData(that.spec.triangles, that.spec.vertices);
    geometry.attributes.position.set( newArray );
    geometry.attributes.position.needsUpdate = true;
    // geometry.computeVertexNormals();
}

/* make the THREE.Geometry match the base geometry deformed by the morphs at the weights
 * passed. If an operator is omitted it is assumed to have weight 0, or no affect on the
 * basis mesh. As the variable name implies, values are in the blender space of the shape
 * key values
 **/
function setSmartMorphWeights(weightHash) {
    var that = this;
    var deltaWeights = {};
    var epsilon = 0.0000001;
    if (!that.renderedWeights) {
        that.resetGeometryFromSpec();
        deltaWeights = weightHash;
    } else {
        Object.keys(that.renderedWeights).map(function(key){
            var oldValue = that.renderedWeights[key];
            var newValue = weightHash[key];
            var delta = newValue - oldValue;

            if (Math.abs(delta) > epsilon) {
                deltaWeights[key] = delta;
            }
        });
    }
    that.applyWeightDeltas(deltaWeights);

    // FIXME: only update cached weights that got updated, conceivably a series of deltas smaller
    // than epsilon would have no effect with this code
    that.renderedWeights = weightHash;
}

/* Take an instance of this class and return a string containing the OBJ format of the
 * related THREE.Mesh
 */
Mesh.toOBJ = function(mesh) {
    return exporter.parse(mesh.threeMesh);
}

