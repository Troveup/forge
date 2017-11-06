
//var bunyan = require('bunyan');
//var log = bunyan.createLogger({name: "mesh"});
var Util = require('forge/Util');
var Control = module.exports;

Control.createGraph = function (operators, controls) {
    var graph = {
        allNodes: {},
        rootHash: {}, // properties are the ids of current roots
        unparsedLeaves: {}, // mapping : childID => parentID
        operatorList: [],
        controlGroupHash: null,

        getControlGroups: getControlGroups,
        buildControlGroups: buildControlGroups,
        propagateRootValues: propagateRootValues,
        getLeafValues: getLeafValues,
        getMappedOperatorValues: getMappedOperatorValues,
        getRootValues: getRootValues,
        setRootValues: setRootValues,
        getNodeValue: getNodeValue,
        setNodeValue: setNodeValue,
        parseNode: parseNode,
    };

    // NOTE: need to parse the operators first or else the control groups will have an undefined mesh
    // a better approach would be to generate the full graph, then go through and create control groups
    if (operators) {
        operators.map( function(op, i) {
            graph.operatorList.push(op.id);
            graph.parseNode(op, 'operator');
        });
    }

    if (controls) {
        controls.map(function(ctrl, i) {
            graph.parseNode(ctrl, 'control');
        });
    }

    graph.buildControlGroups();
    graph.propagateRootValues();
    return graph;
};

// expects normalized values
function setRootValues(valueHash) {
    var that = this;

    if (Array.isArray(valueHash)) {
        var freshHash = {};
        for (var i = 0; i < valueHash.length; i++) {
            freshHash[valueHash[i].id] = valueHash[i].value;
        }
        valueHash = freshHash;
    }

    Util.eachProperty(valueHash, function(nodeID, nodeValue) {
        if (!that.rootHash[nodeID]) return;

        var node = that.allNodes[nodeID];
        node.parentValues.push(nodeValue);
    });
    that.propagateRootValues();
}

/* return an object mapping the node ID to the value of that node in the computed control graph*/
// must call setRootValues before the values here will be valid, can use it to get the toplevel ids though
function getRootValues() {
    var that = this;

    var values = {};
    Util.eachProperty(that.rootHash, function(rootID) {
        var node = that.allNodes[rootID];
        values[rootID] = node.parentValues[0] || node.value;
    });
    return values;
}

/* get the raw weights which will be used directly to scale the contributions of
 * the displacement vectors associated with a shape key
 */
function getMappedOperatorValues() {
    var that = this;
    var params = {};

    // roots won't get properly added to the leaf list, this should ensure all leaves are included
    that.operatorList.map(function(operatorID) {
        if (typeof params[operatorID] == "undefined") {
            var node = that.allNodes[operatorID];
            var denormalized = node.value * (node.max - node.min) + node.min;
            params[operatorID] = denormalized;
        }
    });

    return params;
}

/* get the normalized values (within the range [0,1]) of the leaf nodes in the control
 * graph which correspond to the operators
 */
function getLeafValues() {
    var that = this;
    var params = {};

    // roots won't get properly added to the leaf list, this should ensure all leaves are included
    that.operatorList.map(function(operatorID) {
        if (typeof params[operatorID] == "undefined") {
            var node = that.allNodes[operatorID];
            params[operatorID] = node.value;
        }
    });

    return params;
}

function propagateRootValues() {
    var that = this;

    Util.eachProperty(that.rootHash, function(rootID) {
        propagateSubgraph(that, rootID); // could tail end optimize this recursion
    });
}

function getNodeValue(nodeID) {
    return this.allNodes[nodeID].value;
}

function setNodeValue(nodeID, value) {
    this.allNodes[nodeID] = value;
}


function propagateSubgraph(controlGraph, nodeID) {
    var node = controlGraph.allNodes[nodeID];
    node.inputFunc();

    Util.eachProperty(node.outputFunc(), function(childID, childValue){
        var child = controlGraph.allNodes[childID];
        child.parentValues.push(childValue);
    });

    node.children.map(function(childID) {
        propagateSubgraph(controlGraph, childID);
    });

    node.parentValues = [];
}

// a grouping of the root nodes, simply for visual organization and labelling related sliders
function buildControlGroups() {
    var that = this;

    that.controlGroupHash = {};
    Util.eachProperty(that.rootHash, function(rootID) {
        var node = that.allNodes[rootID];
        if (node.id == "special_necklace_size") {
            // this operator is used for necklaces on the backend to implement size selection
            return;
        }
        if (!that.controlGroupHash[node.groupID]) {
            that.controlGroupHash[node.groupID] = createControlGroup(node.mesh, node.groupID, node.groupLabel);
        }
        that.controlGroupHash[node.groupID].controlIDs.push(rootID);
    });
}

function getControlGroups() {
    var that = this;
    return that.controlGroupHash;
}

function createControlGroup(mesh, id, label, ctrls) {
    return {
        id: id,
        label: label,
        mesh: mesh,
        controlIDs: ctrls || []
    };
}

function parseNode(nodeDef, nodeType) {
    var that = this;

    var newNode = createNode(nodeDef, nodeType);
    that.allNodes[newNode.id] = newNode;

    if (newNode.children.length > 0) {
        var parentID = newNode.id;

        newNode.children.map( function(childID, i) {
            that.unparsedLeaves[childID] = parentID;

            if (that.rootHash[childID]) {
                delete that.rootHash[childID];
            }
        });
    }

    if (!that.unparsedLeaves[newNode.id]) {
        that.rootHash[newNode.id] = true;
    }
    delete that.unparsedLeaves[newNode.id];
}

/* nodeDef - an object from either the controls or operators arrays
 * nodeType - either the string 'control' or 'operator'
 */
function createNode(nodeDef, nodeType) {
    var newNode = {};
    newNode.id = nodeDef.id;
    newNode.label = nodeDef.label || prettifyID(nodeDef.id);

    newNode.children = nodeDef.children || [];
    newNode.parentValues = []; // alternatively, could be the id of parent mapped to the normalized value
    newNode.value = 0;
    newNode.groupID = nodeDef.groupID || "other";
    newNode.groupLabel = nodeDef.groupLabel || "Other";
    newNode.mesh = nodeDef.mesh;

    newNode.min = (typeof nodeDef.minWeight == "undefined") ? 0 : nodeDef.minWeight;
    newNode.max = (typeof nodeDef.maxWeight == "undefined") ? 1 : nodeDef.maxWeight;
    newNode.initial = nodeDef.initial || 0; // this is ok because a falsy value should be equivalent to zero

    newNode.nodeType = nodeType;
    if (nodeDef.type == "morph") {
        newNode.templateKey = 'controlSlider';
    } else if (nodeDef.type == "selection") {
        newNode.templateKey = 'controlDropdown';
    } else {
        // console.log("Defaulting node type to controlSlider (node main type is: "+nodeType+")");
        newNode.templateKey = 'controlSlider';
    }

    newNode.inputFunc = getInputFunc(nodeDef.inputFunc);
    newNode.outputFunc = getOutputFunc(nodeDef.outputFunc);

    return newNode;
}

function prettifyID(rawID) {
    return rawID.replace(/_/g, " ");
}

// NOTE: seems like a good idea to move nodes into their own module
// that would be a good place for filters as well

// Control Filter functionality brought back into the fold
// these functions will be assigned to a node object so can expect `this` to point to the node
var inputFunctionHash = {};
var outputFunctionHash = {};

function getInputFunc(label) {
    label = label ? label.toLowerCase() : "average";
    return inputFunctionHash[label] || inputFunctionHash["average"];
}

function getOutputFunc(label) {
    label = label ? label.toLowerCase() : "direct";
    return outputFunctionHash[label] || outputFunctionHash["direct"];
}

// Page.registerInputFunc('average', function(parentValues) {});

// function average(parentValues)
inputFunctionHash.average = function () {
    var that = this;

    var sum = 0;
    var len = that.parentValues.length;
    if (len == 0) {
        that.value = 0.0; // middle of normalized range
        return;
    }

    for (var i = 0; i < len; i++) {
        sum += that.parentValues[i];
    }

    that.value = sum / len;
};

// for 0-.5 -> scrub backwards through first child (1 .. 0)
// for .5-1 -> scrub forwards through second child (0 .. 1)
outputFunctionHash.combinewithinverse = function() {
    var that = this; // this is a node

    if (that.children.length < 1) {
        return {};
    } else if (that.children.length > 2) {
        console.log("FORGE Error: outputFunc \"middleOut\" is valid for 2 children nodes only");
        return {};
    }

    var idOne = that.children[0];
    var idTwo = that.children[1];
    if (!idOne || !idTwo) {
        console.log("Invalid child node");
        return;
    }

    var childOutputs = {};
    if (that.value < 0.5) {
        childOutputs[idOne] = 1 - 2*that.value;
        childOutputs[idTwo] = 0;
    } else {
        childOutputs[idOne] = 0;
        childOutputs[idTwo] = 2*that.value - 1;
    }
    return childOutputs;
};

// [0,1] => [-1,1]
outputFunctionHash.addselfinverse = function() {
    var that = this;

    if (that.children.length < 1) {
        return {}
    }

    var outputValue = (that.value * 2) - 1;
    var childOutputs = {};
    that.children.map(function(childID) {
        childOutputs[childID] = outputValue;
    });
    return childOutputs;
};

outputFunctionHash.inverse = function() {
    var that = this;

    if (that.children.length < 1) {
        return {};
    }

    var outputValue = 1 - that.value;
    var childOutputs = {};
    that.children.map(function(childID) {
        childOutputs[childID] = outputValue;
    });
    return childOutputs;
};


// function sequential(children, value)
outputFunctionHash.direct = function() {
    var that = this;

    if (that.children.length < 1) {
        return {};
    }

    var childOutputs = {};
    that.children.map(function(childID) {
        childOutputs[childID] = that.value;
    });
    return childOutputs;
};

// function sequential(children, value)
outputFunctionHash.sequential = function() {
    var that = this;

    var len = that.children.length;
    if (len < 1) {
        return {};
    }

    var sectionLength = 1 / len;
    var childOutputs = {};
    that.children.map(function(childID, i) {
        var lower = i * sectionLength;
        var higher = lower + sectionLength;
        var mappedValue = null;

        if (that.value < lower) {
            mappedValue = 0;
        } else if (that.value  > higher) {
            mappedValue = 1;
        } else {
            mappedValue = (that.value - lower) /  sectionLength;
        }

        childOutputs[childID] = mappedValue;
    });
    return childOutputs;
};
