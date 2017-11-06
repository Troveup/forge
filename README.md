
FORGE
=======

## Installation

* make sure you have [node.js](https://nodejs.org/en/download/) installed.

clone project and use npm to install dependencies:

	$ git clone https://github.com/Troveup/forge.git
	$ cd forge
	$ npm install

## Config

modify the config/devconfig.js to your desired settings. Example Below

    module.exports = {
	    debugRoutes: true,
	    environment: 'local',
	    port: 9005,
	    exportPath: "~/src/troveweb/src/main/webapp/WEB-INF/resources/js"
	}

## Building & Running the Test Server

build & compile the backend and frontend. Compiled to build/FORGE-server.js and public/js/FORGE.js

    $ gulp build

run the server. will be listening on http://0.0.0.0:9005 with above config

    $ gulp run

location of textview ->  http://localhost:9005/local/[filename of json model in /public/models/ ]

shut down server. Ctrl+C x 2

    $ Ctrl+C
    $ Ctrl+C

## Directory Structure

```
forge
 │
 ├──── README.md
 │ 
 ├──── blender-scripts
 │      │ 
 │      ├──── trove_export.py          // file imported by blender to add Trove Export functionality
 │      │ 
 │      ├──── blendlib.py              // module used by worker process on server backend
 │ 
 │ 
 ├──── lib
 │      │
 │      ├──── forge                     // library functionality split into modules
 │      │
 │      ├──── custom-three              // three.js forked to import our custom format, ignore uvs
 │      │
 │      ├──── (inactive) halfedge-mesh  // library to serve as basis for general js mesh processing
 │      │
 │      ├──── (inactive) csg            // js modules that implement csg, most have issues
 │         
 ├──── public                           // static files used by the forge test server
 │         
 ├──── server                           // backend logic for test server
 │         
 ├──── spec                             // jasmine test files
 │         
 ├──── temp                             // location for downloaded files to be temporarily saved
 │         
 ├──── view                             // template files for test server view
 │         
```


# Modelling

## (soon to be rewritten) Mapping Blender Object names to model properties:

It's inconvenient for designers to store metadata in an object property, so we define conventions for packing several string properties as they will appear in the JSON model into a single object name value in blender. The object name can be easily updated by pointing and clicking on the text, and during export these values will (eventually) be checked to make sure they conform to our standard. As a result we can translate between the blender and json formats without losing data.

In general a packed name will contain one or more string values separated by a period. Derived ID values will contain no spaces or periods. If an object requires a display name that is not a valid ID, use the display identifier in the blender object name text box in the GUI, at time of export that value will be stored as the label instead, and the value will be formatted properly at export to create a valid ID. When importing back into blender the id is discarded in favor of the label, so it is imperative that the method for canonicalizing display strings into mesh IDs does not change to maintain compatibility.

Note: I don't like how stringly typed this is, we can come up with something better. Blender has true object groups we can use for channels once there's a bit of time to update the exporter.

Mesh Object: "Mesh Label.Channel Label" =>
    meshLabel = name.split(".")[0]
    channelLabel = name.split(".")[1] || "Primary"
    channelID = canonical(channelLabel)
    meshID = channelID +"___"+ canonical(meshLabel)

Operator Object: "Operator Label.Group Label" =>
    operatorLabel = name.split(".")[0]
    groupLabel = name.split(".")[1] || "Other"
    groupID = canonical(groupLabel)
    operatorID = groupID +"___"+ canonical(operatorLabel)


## Diameter

# (outdated) Customizer

## Model Json Definitions

Type Model
{
    "metadata": {
        "diameter"      : 14.998829,
        "category"      : "ring",
        "formatVersion" : 6,
        "generatedOn"     : <timestamp>,
    },
    "meshes": [ ... ],
    "operators": [ ... ],
    "controls": [ ... ]
}

Type Mesh
{
    "id"            : "parted_ring",
    "label"         : "Parted Ring",
    "channelID"     : "primary",
    "channelLabel"  : "Primary",
    "numvertices"   : 2062,
    "numtriangles"  : 4128
    "vertices"      : [ ... ],
    "triangles"     : [ ... ]
}

VERSION ~2 of Mesh Object (no longer necessary to record once database cleanup occurs)

{
    "meta" : {
        "id"            : "parted", // globally unique among meshes
        "channel"       : "main", // only one mesh visible from this channel at a time
        "vertices"      : 2062,
        "triangles"     : 4128
    },
    "vertices": [ ... ],
    "triangles": [ ... ],
    "threeMesh": <three mesh ref> // if falsy, then not the active mesh
}

Type MorphOperator
{
    "id": "operatorID",
    "label": "Operational Identification",
    "groupID": "other",
    "groupLabel": "Other",
    "mesh": "meshID",
    "type": "morph",
    "minWeight": 0.0,
    "maxWeight": 1.0,
    "params": {
        "modifiedVertices": %s,
        "indices": [%s],
        "displacements": [%s]
    }
}

Type ControlNode
{
    "id": "control_left_bend",
    "label": "Bend",
    "groupID": "left_arm",
    "groupLabel": "Left Arm",
    "mesh": "flowing_ring", // for now need to manually define this
    "children": [ "other___left_arm_up_primary___flowing_ring" ],
    "inputFunc": "average",
    "outputFunc": "combinewithinverse"
}


// (proposed format) all meshes are implicitly assumed to be unioned if not otherwise specified
Type CSGOperator
{
    "id": "combineID",
    "type": "csg",
    "params": {
        "meshes": [ "meshID", "mesh2ID" ],
        "combinedID": "ultiMesh", // id to save the resulting mesh under
        "mix": "union" // a union only explicitly necessary if the result is to be combined
    }
}

CSG (In Flux)
------

- if no CSG relations specified, assume all meshes to be unioned
- use operators to define difference or intersection relationships
- (if computationally feasible) intersect/subtractive operations happen in realtime at render stage

Auxiliary Bookkeeping Structures
------

- maintain channel ID => active mesh ID for that channel
- maintain mesh ID => mesh Object mapping
- csg graph: think of a good representation for this

Page Interface
======

- define callbacks and attach event listeners for FORGE functionality that interacts with the page
- provide an entry point for the customizer on the page

Scene Managemnet
======

- THREE code related to rendering
- update material of the objects
- update the renderer
- move the camera

Control Graph
======

A control node is a unit of organization for transforming the initial slider input through a series
of combined inputs and filtered outputs. The Control module takes the operator and control
definitions to create a directed acyclic graph where all the leaf nodes are operators, and the root
nodes represent sliders or other control inputs.

TODO - work out related control node constraints, possibly bubbling them up from intermediate nodes

Value Propagation
------

- each toplevel slider correlates to a root node, get the $slider.val() and normalize the
  value based on the min,max parameters
- use the inputFunc to normalize parent outputs onto range [0,1]
- use the outputFunc to filter to any children, recurse

Input Functions
------

- average - whatever
- sum - sum of inputs, useful if one morph has a slider for its normal direction and inverse
- normalize - scale to 0 to 1
- upperHalfUnit - scale from min to max range down to .5 to 1 (only positive scale morph)
- lowerHalfUnit - scale from min to max range down to 0 to .5 (inverse of positve morph)

Output Functions
------

pipe - output is unaltered
inverse - newValue = (1 - value)
sequential - if two outputs, [0,.5] ranges through the whole range of the first ouput
split - value divided by the number of outputs (not sure if we need this one)

(outdated) Control Markup
-------

The following html is generated by the control JS code, including listeners so that the working
values for the operator paramets will be updated as soon as the slider event fires.

Look in `lib/forge/control-box.hbs` for the html.

Current constraints:
- controls and operators in the same control group must point to the same mesh
- in control definition list, masked controls should come before the visible ones in order of
  suppression

Utility
======

- logging and utility - random helper functions

TODO
======

- highlight boundary edges, count and display # holes
- http://www.cad.zju.edu.cn/home/hwlin/pdf_files/A-robust-hole-filling-algorithm-for-triangular-mesh.pdf
+ advancing front mesh technique
+ poisson normal distribution (maybe not necessary yet?)
+ possibly skip advanced smoothing and focus on eliminating degenerate faces (should be easier, haven't found a specific treatment though)

gcloud admin
------

- list models on bucket
- show stats on model when prompted (vertices, faces, operators, controls, holes)
    - maybe cache these so processing isn't necessary?
- preview the result of csg or other irreversible transformations
- add controls / operators to in browser model, prefer json change, confirm and overwrite model on bucket


Model exporting
{
    size: "ring_5",
    // lookup file at "<trove-cdn bucket root>/models/ring-pretty-loop-VERSIONSTRING.json"
    model: "ring-pretty-loop",
    version: "VERSIONSTRING",
    "bucket": "trove-cdn",

    // selecting meshes method 1: 
    visible: [ "meshOneID", "meshTwoID" ], // default action is to union all visible meshes

    // selecting meshes method 2: more verbose but can't specify invalid scenes
    <!--activeMeshes: {-->
        <!--"channelID": "meshOneID",-->
        <!--"channelTWo": null // unless specifically set to null the first parsed mesh in the channel will be used (or not, if that seems like a bad default)-->
    <!--}-->

    operators: [
        "id": "op1",
        // if custom java classes needed, include a "type" property to hint the class
        "value": {} // value can be anything, string, int, float...
    ]
}


Testing
======

gulp serve


curl -H "Content-Type: application/json" -X POST \
        -d '{"exportPath": "nodeoutput1.obj", "importBucket": "troveup-dev-private", "importPath": "models/tri-cube.json", "visible": ["main.Cube"], "size": "ring_6.5"}' \
        localhost:9001/api/export

curl -H 'Content-type: application/json' -X POST -d '{"exportBucket": "troveup-dev-private", "exportPath": "exports/nodeoutput1.obj", "importBucket": "troveup-dev-private", "importPath": "debug/text_ball.json", "visible": ["main.Cube", "main.Motto1"], "size": "ring_6.5"}' localhost:9001/api/export

curl -H "Content-Type: application/json" -X POST -d '{"exportPath": "nodeoutput1.obj", "visible": ["main.Mirror_Ring"], "importUrl": "https://storage.googleapis.com/troveup-dev-private/models/mirror-no-hole.json", "size": "ring_6.5", "operators": []}' localhost:9001/api/export

curl -H 'Content-type: application/json' -X POST -d '{"exportBucket": "troveup-dev-private", "exportPath": "exports/necklace-test.obj", "importBucket": "troveup-dev-private", "importPath": "models/closed_circle_necklace.json", "visible": ["primary___circle_pendant", "static-objects___bail"], "size": "necklace_1", "enableRender": true}' localhost:9005/api/export

curl -H "Content-Type: application/json" -X POST -d '{"importUrl": "https://storage.googleapis.com/troveup-dev-private/models/atom_ring_01_10_16_update.json","modelName":"atom_ring", "visible": ["ring_one___ring", "ring_two___ring"], "operators": [{"id": "ring_one___ring___other___ring_width_ring_one___ring", "value": 0.5}]}' localhost:9005/api/volume


UI
======

Example hash:

templateContext = {
    singleChannel: true,
    renderChannels: [
        {
            label: "English Channel",
            singleMesh: false,
            meshes: [
                {
                    id: "cuboid",
                    label: "The Splendorous Cube",
                    singleGroup: true,
                    controlGroups: [
                        {
                            name: "Other",
                            sliders: [
                                { id: "corner", label: "Triumphant Rise" }
                            ]
                        }
                    ]
                },
                {
                    id: "spheroid",
                    label: "The Inimitable Sphere"
                }
            ]
        }
    ]
};


Format 7
======

Some notes on this as it begins to take shape

General
- all objects will have a property `type` which informs processing algorithms what processing methods to use.
- 

{
    type: "control",
    id: "whatever",
    source: {
        type: "blendFunction", //  or "input" for controls or 
        func: "average"

        // or...
        //type: "slider",
        //min: 0,
        //max: 1,
    },
    output: {
        type: "operator",
        
        // or...
        //type: "control",
    }
}


