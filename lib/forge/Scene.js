
var THREE = require('custom-three');
var Mesh = require('forge/Mesh');
var Control = require('forge/Control');
var Util = require('forge/Util');
var Scene = module.exports;

/* The Scene Module - handle loading and exporting the details necessary to instantiate a
 * model that can be updated by applying new operators or tuning existing parameters.
 * When used on frontend additionally handles the Three.js customizer animation.
 **/

Scene.create = function(configHash){
    var troveScene = {
        setConfig: setConfig,
        getConfig: getConfig,
        reset: reset,
        setChannelMeshesVisible: setChannelMeshesVisible,
        processActive: processActive,
        updateModelRadius: updateModelRadius,
        getActives: getActives,
        calculateScaleFactor: calculateScaleFactor,
        propagateValuesToGeometry: propagateValuesToGeometry,
        readNormalizedRootValues: readNormalizedRootValues,
        readInputValues: readInputValues,
        registerMesh: registerMesh,
        getModelVolume: getModelVolume,
        changeChannelMesh: changeChannelMesh,
        getGeometryVolumesSum: getGeometryVolumesSum,
        parseModel: parseModel,
        setRenderWrapper: setRenderWrapper,
        updateMeshMaterials: updateMeshMaterials,
        getOperatorsForExport: getOperatorsForExport
    };

    troveScene.cfg = configHash || {};

    /* The `channels` object stores data about the render channels in the scene and keeps track
     * of the meshes that belong them.  */
    troveScene.channels = {};

    /* Maps each mesh ID to the data blob representing it. Handles for Three.js objects are stored
     * here as well when the mesh is the active item for its channel and therefore currently being
     * rendered. */
    troveScene.sceneMeshes = {};

    troveScene.controlGraph = null;
    troveScene.renderWrapper = null;

    return troveScene;
};

Scene.getCategoryDefaultSize = function(category) {
    var sizeValue = "unknown_category";
    if (category == "bracelet") {
        sizeValue = "bracelet_3";
    } else if (category == "ring") {
        sizeValue = "ring_7";
    } else if (category == "necklace") {
        sizeValue = "necklace_1";
    }
    return sizeValue;
};

function setRenderWrapper(wrapperParam) {
    var that = this;

    that.renderWrapper = wrapperParam;
}

// generates a javascript object representing the parameters expected by the export api on the
// node server, then adds a stringified encoding to the post data to troveweb
// FIXME: handle the size and material stuff in Page, this should just add slider and operator weights
function getOperatorsForExport(exportData, sizeValue, materialValue) {
    var that = this;

    var seenIDs = {}; // use this to prevent double exporting operators directly added as slider nodes
    var operators = [];
    // or, could simply export slider and operator values separately (probably should update to this at
    // some point)

    Util.eachProperty(that.controlGraph.getRootValues(), function(sliderID, sliderValue) {
        operators.push({ id: sliderID, value: sliderValue });
        seenIDs[sliderID] = true;
    });

    Util.eachProperty(that.controlGraph.getLeafValues(), function(operatorID, operatorValue) {
        if (seenIDs[operatorID]) return;
        operators.push({ id: operatorID, value: operatorValue });
    });

    return operators;
}

// grouping data in preparation for the next model. Think of it as a repeatable init function.
function parseModel(model) {
    var that = this;
    that.reset();

    that.setConfig("diameter", model.metadata.diameter);
    that.setConfig("category", model.metadata.category);
    that.setConfig("formatVersion", model.metadata.formatVersion);

    model.meshes.map(function(meshSpec){
        that.registerMesh(meshSpec, false);
    });

    model.operators.map(function(op){
        that.sceneMeshes[op.mesh].registerOperator(op);
    });

    that.updateModelRadius();
    that.controlGraph = Control.createGraph(model.operators, model.controls);
    that.propagateValuesToGeometry();
}

function updateModelRadius() {
    var that = this;

    var boundingRadius = 0;
    that.processActive(function(troveMesh){
        troveMesh.threeMesh.geometry.computeBoundingSphere();
        var centerDisplacement = troveMesh.threeMesh.geometry.boundingSphere.center.length();
        var radius = troveMesh.threeMesh.geometry.boundingSphere.radius + centerDisplacement;
        if (radius > boundingRadius) boundingRadius = radius;
    });
    that.setConfig("itemRadius", boundingRadius);
}

function get() {
    var that = this;
    return that.threeScene;
}

function getConfig(label) {
    var that = this;
    return that.cfg[label];
}

function setConfig(label, value) {
    var that = this;
    that.cfg[label] = value;
}

// Resetting the mesh module clears any existing meshes in the scene and sets up the empty mesh
function reset() {
    var that = this;

    if (that.threeScene) {
        if (Object.keys(that.channels).length > 0) {
            Util.eachProperty(that.channels, function(channelID, channel) {
                var oldActive = that.threeScene.getObjectByName(channel.activeID);
                if (oldActive) that.threeScene.remove(oldActive);
            });
        }
    }

    that.sceneMeshes = {};
    that.channels = {};
}

function processActive(callback) {
    var that = this;

    if (!that.channels) {
        console.log("FORGE Error: No active meshes yet, premature processing.");
        return;
    }

    Util.eachProperty(that.channels, function(channelID, channel) {
        callback(that.sceneMeshes[channel.activeID]);
    });
}

// adds to the list of scene meshes
// if no active mesh for this channel also makes this the active
function registerMesh(meshSpec, makeActive) {
    var that = this;

    var mesh = Mesh.create(meshSpec);
    var meshID = mesh.spec.id;
    var channelID = mesh.spec.channelID;
    var channelLabel = mesh.spec.channelLabel;

    if (!!that.sceneMeshes[mesh.id]) { // do we care about this case?
        console.log("FORGE Error: Overwriting ["+mesh.id+"]");
    }
    that.sceneMeshes[mesh.id] = mesh;

    if (!that.channels[channelID]) {
        that.channels[channelID] = {};
        that.channels[channelID].id = channelID;
        that.channels[channelID].meshes = [];
    }

    that.channels[channelID].meshes.push(meshID);

    var channelMeshID = that.channels[channelID].active; // assuming that.sceneMeshes[channelMeshID] will exist if this is true
    if (makeActive || !channelMeshID) {
        var newestMesh = that.changeChannelMesh(channelID, meshID);
    }
    return newestMesh;
}

/* a list of mesh IDs to set as active within the scene. subsequent mesh entries from the same
 * channel will overwrite earlier entries.
 */
function setChannelMeshesVisible(visibleList) {
    var that = this;

    if (!visibleList || visibleList.length == 0) {
        console.log("Visible list is empty, use currently active meshes");
        return;
    }

    visibleList.map(function(meshID){
        var mesh = that.sceneMeshes[meshID];
        that.changeChannelMesh(mesh.spec.channelID, mesh.id);
    });
}

// use the saved mesh definition to rebuild the THREE.Mesh and replace the active scene element
// FIXME: get reference to the three scene from the Render module
function changeChannelMesh(channelID, meshID) {
    var that = this;

    // that.channels[channelID] = that.channels[channelID] || {};
    var currentMeshID = that.channels[channelID].activeID;
    if (currentMeshID == meshID) {
        if (that.getConfig("debug")) {
            console.log("FORGE Info: "+meshID+" is already the active mesh for channel"+ channelID+", aborting switch.");
        }
        return;
    }

    var mesh = that.sceneMeshes[meshID];
    mesh.resetGeometryFromSpec();
    delete mesh.renderedWeights;
    mesh.threeMesh.name = meshID;
    that.channels[channelID].activeID = meshID;

    if (!that.renderWrapper) {
        return;
    }

    that.renderWrapper.removeModelMesh(currentMeshID);
    that.renderWrapper.addModelMesh(mesh.threeMesh);

    return mesh.threeMesh;
}

function getActives() {
    var that = this;

    var ids = {};
    if (that.channels) {
        Util.eachProperty(that.channels, function(channelID, channel){
            ids[channel.activeID] = true;
        });
    }
    return ids;
}

/**
* @param visible - the meshes that should be visible, though it won't overwrite what's valid for a channel
* @param operatorWeights - an array of objects mapping operator ids to weights
* @param size - size of the model that the volume measurement should reflect
* @returns - scaled volume of the model in cubic millimeters
*/
var getModelVolume = function (visible, operatorWeights, size) {
    var that = this;

    if (visible) {
        that.setChannelMeshesVisible(visible);
    }

    if (operatorWeights) {
        that.readNormalizedRootValues(operatorWeights);
        that.propagateValuesToGeometry();
    }

    var rawVolume = that.getGeometryVolumesSum()

    if (!size) {
        var jewelryCategory = that.getConfig("category");
        size = Scene.getCategoryDefaultSize(jewelryCategory);
    }
    var sf = that.calculateScaleFactor(size);
    return rawVolume * sf * sf * sf;
}

/* Calculate the volume of the unscaled mesh geometries, assumes that the proper meshes
 * have been made active and operator weights propagated to the geometry before this is
 * called. Overcounts volumes that belong to the intersection of multiple meshes.
 */
function getGeometryVolumesSum() {
    var that = this;

    var activeMeshIDs = Util.objKeysToArray(that.getActives());
    var threeMeshes = activeMeshIDs.map(function(meshID) {
        var result = that.sceneMeshes[meshID];
        if (!result.threeMesh) {
            console.warn("not sure what to do here...");
            // result.setSmartMorphWeights();
        }
        return result.threeMesh;
    });

    var volumeSummation = 0;
    for (var i = 0, il = threeMeshes.length; i < il; i++) {
        volumeSummation += Mesh.calcThreeVolume(threeMeshes[i]);
    }
    return volumeSummation;
}


/* UNIMPLEMENTED: this depends on the CSG module working as expected, which requires finishing the
 * halfedge mesh lib to fix the holes.
 * This should take the union volume of all the active meshes, and take the volume of that in order
 * to avoid over counting the intersections.
 */
function getMeshUnionVolume() {}

// takes the size parameter as generated on the FORGE frontend exporter:
// "ring_7.5", "ring_6", "bracelet_extra-small"
function calculateScaleFactor(sizeParam) {
    var that = this;

    var sizeParts = sizeParam.split("_");
    var sizeCategory = sizeParts[0];
    var sizeValue = 0;
    var targetDiameter = 1; // unprintably small so we know immediately something got messed up
    var originalDiameter = that.getConfig("diameter");

    var braceletSizes = [ "extra-small", "small", "medium", "large", "extra-large" ];

    if (sizeCategory == "ring") {
        sizeValue = parseFloat(sizeParts[1]);
        targetDiameter = .825 * sizeValue + 11.6;
    } else if (sizeCategory == "bracelet") {
        sizeValue = parseInt(sizeParts[1]);
        targetDiameter = 5 * sizeValue + 50;
    } else if (sizeCategory == "necklace") {
        // FIXME: eventually will use this function to calculate necklace scale, but for now
        // necklace sizing will be implemented via shape keys in the normal control section
        originalDiameter = 1;
        targetDiameter = 1;
    } else {
        console.log("Invalid category for sizing purpose: "+sizeCategory);
    }

    var scaleFactor = targetDiameter / originalDiameter;
    if (that.getConfig("debug")) {
        console.log("Desired diameter of "+targetDiameter+"; scaling original diameter "+originalDiameter+" up by a factor of "+scaleFactor);
    }
    return scaleFactor;
}

function updateMeshMaterials() {
    var that = this;

    var materialChange = that.renderWrapper.getMaterial();
    that.processActive(function(troveMesh) {
        troveMesh.threeMesh.material = materialChange;
    });
}

/* Read the graph to get the current operator weights and update the geometry
 * in the THREE.Scene meshes to reflect current weights
 */
function propagateValuesToGeometry() {
    var that = this;

    var operatorParams = that.controlGraph.getMappedOperatorValues();
    that.processActive(function(troveMesh){
        troveMesh.setSmartMorphWeights(operatorParams);
    });
}

/* take raw denormalized values from page elements, normalize before passing
 * into control graph roots
 */
function readInputValues(inputValueHash) {
    var that = this;

    // TODO: proper normalizing logic, for now all controls are on scale out of 0-100
    Object.keys(inputValueHash).map(function(opID){
        inputValueHash[opID] /= 100;
    });

    that.controlGraph.setRootValues(inputValueHash);
}

/* take normalized values from page elements */
function readNormalizedRootValues(inputValueHash) {
    this.controlGraph.setRootValues(inputValueHash);
}

