
var THREE = require('../custom-three');
var ThreeBSP = require('./ThreeCSG');

module.exports = (function(){
    var CSG = {};

    // take an array of THREE.Mesh objects and return the resulting combined THREE.Mesh
    var combine = function(threeMeshes) {
        var bspResult; 
        for (var i = 0; i < threeMeshes.length; i++) {
            var bspMesh = new ThreeBSP( threeMeshes[i] );

            if (i == 0) {
                bspResult = bspMesh;
                continue;
            }

            bspResult = bspMesh.union(bspResult);
        }
        return bspResult.toMesh( new THREE.MeshNormalMaterial({ shading: THREE.SmoothShading }) );
    }

    CSG.combine = combine;
    return CSG;
})();



// return threeMesh for boolean of referenced mesh IDs
//var csgTest = function(meshIDs) {
    //var meshes = [];
    //var scene = FORGE.Scene.get();

    //if (meshIDs.length > 1) {
        //$.each(meshIDs, function(i, meshID) {
            //meshes.push( get(meshID).threeMesh );
            //scene.remove( meshes[meshes.length-1] );
        //});
    //}

    //var geo1CSG = THREE.CSG.toCSG( meshes[0] );
    //var geo2CSG = THREE.CSG.toCSG( meshes[1] );

    //var unionResult = geo1CSG.union( geo2CSG );
    //var result = THREE.CSG.fromCSG(unionResult);

    //// var exporter = new OBJExporter(); // FIXME
    //result.geometry.computeVertexNormals();

    //scene.add(result);

    //return null; // exporter.parse(result);
//};
