
var Scene = require('../../lib/forge/Scene');
var THREE = require('../../lib/custom-three');
var topConfig = require('../../config/config.js');
var path = require('path');
var https = require('https');

function fetchModel(modelURL) {
    var deferred = $.Deferred();
    https.get(modelURL, function(res){
        console.log("Status code: "+res.statusCode);
        deferred.resolve(res.statusCode);
    });
    return deferred.promise();
}

describe("Scene Module", function() {
    describe("basic functionality", function() {
        it("should export a function", function() {
            expect(Scene).toBeDefined();
            expect(Scene.create).toBeDefined();
            expect(typeof Scene.create === 'function').toBeTruthy();
        });
    });

    describe("volume tests", function() {
        var modelTestCases = [
            {
                // currently "atom_ring_vol.json" without the digit suffix is still pointing to an
                // invalid mesh because of caching. If it starts working then we will be fine overwriting
                modelURL: "https://storage.googleapis.com/troveup-dev-private/models/atom_ring_vol2.json",
                configurations: [
                    {
                        operators: [
                            {"id": "ring_two___ring___other___ring_width_ring_two___ring", "value": 0},
                            {"id": "ring_one___ring___other___ring_width_ring_one___ring", "value": 0}
                        ],
                        visible: ["ring_two___ring", "ring_one___ring"],
                        size: "ring_7",
                        scaledMeshVolumeSummation: 276.531
                    },
                    {
                        operators: [
                            {"id": "ring_two___ring___other___ring_width_ring_two___ring", "value": 0.5},
                            {"id": "ring_one___ring___other___ring_width_ring_one___ring", "value": 0.5}
                        ],
                        visible: ["ring_two___ring", "ring_one___ring"],
                        size: "ring_7",
                        scaledMeshVolumeSummation: 517.176
                    }
                ]
            },
            {
                modelURL: "https://storage.googleapis.com/troveup-dev-private/models/bar_ring_vol.json",
                configurations: [
                    {
                        operators: [
                            {"id": "primary___bar_ring___prism___width_primary___bar_ring", "value": 0},
                            {"id": "primary___bar_ring___prism___depth_primary___bar_ring", "value": 0},
                            {"id": "primary___bar_ring___prism___height_primary___bar_ring", "value": 0},
                            {"id": "primary___bar_ring___other___ring_width_primary___bar_ring", "value": 0}
                        ],
                        visible: ["primary___bar_ring"],
                        size: "ring_7",
                        scaledMeshVolumeSummation: 112.281
                    },
                    {
                        operators: [
                            {"id": "primary___bar_ring___prism___width_primary___bar_ring", "value": 0.5},
                            {"id": "primary___bar_ring___prism___depth_primary___bar_ring", "value": 0.5},
                            {"id": "primary___bar_ring___prism___height_primary___bar_ring", "value": 0.5},
                            {"id": "primary___bar_ring___other___ring_width_primary___bar_ring", "value": 0.5}
                        ],
                        visible: ["primary___bar_ring"],
                        size: "ring_7",
                        scaledMeshVolumeSummation: 1357.38
                    }
                ]
            },
            {
                modelURL: "https://storage.googleapis.com/troveup-dev-private/models/crown_ring_vol2.json",
                configurations: [
                    {
                        visible: ["primary___crown_ring"],
                        size: "ring_7",
                        operators: [
                            {"id": "primary___crown_ring___other___create_top_points_primary___crown_ring", "value": 0},
                            {"id": "primary___crown_ring___other___create_bottom_points_primary___crown_ring", "value": 0},
                            {"id": "primary___crown_ring___other___stretch_ring_primary___crown_ring", "value": 0}
                        ],
                        scaledMeshVolumeSummation: 93.1149
                    },
                    {
                        visible: ["primary___crown_ring"],
                        size: "ring_7",
                        operators: [
                            {"id": "primary___crown_ring___other___create_top_points_primary___crown_ring", "value": 0.5},
                            {"id": "primary___crown_ring___other___create_bottom_points_primary___crown_ring", "value": 0.5},
                            {"id": "primary___crown_ring___other___stretch_ring_primary___crown_ring", "value": 0.5}
                        ],
                        scaledMeshVolumeSummation: 443.8901
                    }
                ]
            },
            {
                modelURL: "https://storage.googleapis.com/troveup-dev-private/models/flowing_ring_vol.json",
                // scaleFactor: 1.150788685988745,
                configurations: [ // surprisingly similar values for pretty different shape, was confusing during debugging...
                    {
                        visible: ["primary___flowing_ring"],
                        size: "ring_7",
                        
                        operators: [
                            {"id": "control_left_bend", "value": 0.5},
                            {"id": "control_right_bend", "value": 0.5},
                            {"id": "primary___flowing_ring___left_arm___straighten_primary___flowing_ring", "value": 0},
                            {"id": "primary___flowing_ring___right_arm___straighten_primary___flowing_ring", "value": 0},
                            {"id": "primary___flowing_ring___other___ring_width_primary___flowing_ring", "value": 0}
                        ],
                        scaledMeshVolumeSummation: 256.927
                    },
                    {
                        visible: ["primary___flowing_ring"],
                        size: "ring_7",
                        operators: [
                            {"id": "control_left_bend", "value": 0},
                            {"id": "control_right_bend", "value": 0},
                            {"id": "primary___flowing_ring___left_arm___straighten_primary___flowing_ring", "value": 0.5},
                            {"id": "primary___flowing_ring___right_arm___straighten_primary___flowing_ring", "value": 0.5},
                            {"id": "primary___flowing_ring___other___ring_width_primary___flowing_ring", "value": 0}
                        ],
                        scaledMeshVolumeSummation: 259.669
                    }
                ]
            },
            {
                modelURL: "https://storage.googleapis.com/troveup-dev-private/models/horizon_ring_vol.json",
                rawDiameter: 14.006302,
                scaleFactor: 1.24051302049606,
                configurations: [
                    {
                        visible: ["primary___horizon_ring"],
                        size: "ring_7",
                        operators: [
                            {"id": "control_stretch_top", "value": 0.0},
                            {"id": "control_stretch_bottom", "value": 0.0},
                            {"id": "primary___horizon_ring___other___left_edge_roundness_primary___horizon_ring", "value": 0.0},
                            {"id": "primary___horizon_ring___other___right_edge_roundness_primary___horizon_ring", "value": 0.0}
                        ],
                        scaledMeshVolumeSummation: 221.767
                    },
                    {
                        visible: ["primary___horizon_ring"],
                        size: "ring_7",
                        operators: [
                            {"id": "control_stretch_top", "value": 0.5},
                            {"id": "control_stretch_bottom", "value": 0.5},
                            {"id": "primary___horizon_ring___other___left_edge_roundness_primary___horizon_ring", "value": 0.5},
                            {"id": "primary___horizon_ring___other___right_edge_roundness_primary___horizon_ring", "value": 0.5}
                        ],
                        scaledMeshVolumeSummation: 458.071
                    }
                ]
            },
            {
                modelURL: "https://storage.googleapis.com/troveup-dev-private/models/keyhole_ring_vol.json",
                rawDiameter: 14.004819,
                scaleFactor: 1.240644381051979,
                configurations: [
                    {
                        visible: ["primary___keyhole_ring"],
                        size: "ring_7",
                        operators: [
                            {"id": "primary___keyhole_ring___other___top_edge_roundness_primary___keyhole_ring", "value": 0.0},
                            {"id": "primary___keyhole_ring___other___top_edge_height_primary___keyhole_ring", "value": 0.0},
                            {"id": "primary___keyhole_ring___other___bottom_edge_roundess_primary___keyhole_ring", "value": 0.0}
                        ],
                        scaledMeshVolumeSummation: 190.710
                    },
                    {
                        visible: ["primary___keyhole_ring"],
                        size: "ring_7",
                        operators: [
                            {"id": "primary___keyhole_ring___other___top_edge_roundness_primary___keyhole_ring", "value": 0.5},
                            {"id": "primary___keyhole_ring___other___top_edge_height_primary___keyhole_ring", "value": 0.5},
                            {"id": "primary___keyhole_ring___other___bottom_edge_roundess_primary___keyhole_ring", "value": 0.5}
                        ],
                        scaledMeshVolumeSummation: 248.257
                    }
                ]
            },
            {
                modelURL: "https://storage.googleapis.com/troveup-dev-private/models/shape_outline_bracelet_vol2.json",
                rawDiameter: 54.319437,
                scaleFactor: 1.19662506811328,
                configurations: [
                    {
                        visible: [ "band___triangle", "shape___square" ],
                        size: "bracelet_3",
                        operators: [
                            { "id": "shape___square___other___height_shape___square", "value": 0.0 }
                        ],
                        scaledMeshVolumeSummation: 1229.289
                    },
                    {
                        visible: [ "band___triangle", "shape___square" ],
                        size: "bracelet_3",
                        operators: [
                            { "id": "shape___square___other___height_shape___square", "value": 1.0 }
                        ],
                        scaledMeshVolumeSummation: 1624.98
                    },
                    {
                        visible: [ "band___triangle", "shape___hexagon" ],
                        size: "bracelet_3",
                        operators: [
                            { "id": "shape___hexagon___other___height_shape___hexagon", "value": 0.0 }
                        ],
                        scaledMeshVolumeSummation: 1176.651
                    },
                    {
                        visible: [ "band___triangle", "shape___hexagon" ],
                        size: "bracelet_3",
                        operators: [
                            { "id": "shape___hexagon___other___height_shape___hexagon", "value": 1.0 }
                        ],
                        scaledMeshVolumeSummation: 1557.173
                    },
                    {
                        visible: [ "band___triangle", "shape___circle" ],
                        size: "bracelet_3",
                        operators: [
                            { "id": "shape___circle___other___height_shape___circle", "value": 0.0 }
                        ],
                        scaledMeshVolumeSummation: 1042.745
                    },
                    {
                        visible: [ "band___triangle", "shape___circle" ],
                        size: "bracelet_3",
                        operators: [
                            { "id": "shape___circle___other___height_shape___circle", "value": 1.0 }
                        ],
                        scaledMeshVolumeSummation: 1321.822
                    },
                    {
                        visible: [ "band___semicircle", "shape___circle" ],
                        size: "bracelet_3",
                        operators: [
                            { "id": "shape___circle___other___height_shape___circle", "value": 0.0 }
                        ],
                        scaledMeshVolumeSummation: 1188.678
                    },
                    {
                        visible: [ "band___square", "shape___circle" ],
                        size: "bracelet_3",
                        operators: [
                            { "id": "shape___circle___other___height_shape___circle", "value": 0.0 }
                        ],
                        scaledMeshVolumeSummation: 1696.513
                    }
                ]
            }
            
        ];

        modelTestCases.map(function(testModel, index) {
            it("should have proper volume for "+path.basename(testModel.modelURL), function(done){
                var troveScene = Scene.create({});
                $.getJSON(testModel.modelURL, function(modelJSON) {
                    troveScene.parseModel(modelJSON);

                    testModel.configurations.map(function(testInstance) {
                        var volume = troveScene.getModelVolume(testInstance.visible, testInstance.operators, testInstance.size);
                        expect(volume).toBeCloseTo(testInstance.scaledMeshVolumeSummation, 0);
                    });
                    done();
                });
            });
        });

    });


});

// test of model served from local dev server
