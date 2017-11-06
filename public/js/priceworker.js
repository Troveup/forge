/**
 * Created by tim on 9/23/15.
 *
 * Worker used for asynchronously calling FORGE to get the volume of the object on-screen.
 * IM: moved copy of this worker source to FORGE repo for debugging purposes
 */

/**
 * Calculates the volume of the object using the FORGE library.  Expects the exportHash and the jsonFileContents
 * for use with instantiating the scene.
 *
 * @param data Array of data, the first index of which must contain the exportHash, the second of which should contain
 * the JSON file contents of the model volume being calculated.
 */

importScripts('/js/FORGE.js');

var modelJSON;
var workerScene;

self.addEventListener('message', function(e) {
    var data = e.data;

    switch (data.cmd) {
        case 'load':
            modelJSON = data.modelJSON;
            workerScene = FORGE.Scene.create();
            workerScene.parseModel(modelJSON);
            break;
        case 'ping':
            console.log(modelJSON);
            break;
        case 'volume':
            var exportHash = data.exportHash;
            var visible = !!exportHash.visible ? exportHash.visible : null;
            var operators = !!exportHash.operators ? exportHash.operators : null;
            var volume = workerScene.getModelVolume(visible, operators);
            postMessage({
                type: 'model-volume',
                volume: volume
            });
            break;
    };

}, false);
