
var Mesh = require('../../lib/forge/Mesh');
var Scene = require('../../lib/forge/Scene'); // yeah yeah, not proper unit testing
var cfg = require('../../config/config.js');

describe("Mesh Module", function() {

    var volumeModelTests = [
        {
            testName: "simple volume test, with altered range operator weight",
            modelURL: "http://"+cfg.lanIP+":9005/models/volume_test.json",
            operators: [
                { "id": "operator_clipped_height", "value": 0 },
                { "id": "operator_height", "value": 0 }
            ],
            visible: [ "primary___normal_morph" ],
            size: "ring_7",
            expectedVolume: 5245.349
        },
        {
            testName: "simple volume test, with altered range operator weight",
            modelURL: "http://"+cfg.lanIP+":9005/models/volume_test.json",
            operators: [
                { "id": "operator_clipped_height", "value": 0 },
                { "id": "operator_height", "value": 0 }
            ],
            visible: ["primary___remapped_weight"], 
            size: "ring_7",
            expectedVolume: 7868.024
        }
    ];

    it("should export a function", function() {
        expect(Mesh).toBeDefined();
        expect(Mesh.create).toBeDefined();
        expect(typeof Mesh.create === 'function').toBeTruthy();
    });

    /*it("should load volume test model", function(done){
        var troveScene = Scene.create({});
        var testCase = volumeModelTests[0];
        $.getJSON(testCase.modelURL, function(modelJSON) {
            troveScene.parseModel(modelJSON);
            var volume = troveScene.getModelVolume(testCase.visible, testCase.operators, testCase.size);
            expect(volume).toBeCloseTo(testCase.expectedVolume, 0);
            done();
        });
    });

    it("should load volume test model", function(done){
        var troveScene = Scene.create({});
        var testCase = volumeModelTests[1];
        $.getJSON(testCase.modelURL, function(modelJSON) {
            troveScene.parseModel(modelJSON);
            var volume = troveScene.getModelVolume(testCase.visible, testCase.operators, testCase.size);
            expect(volume).toBeCloseTo(testCase.expectedVolume, 0);
            done();
        });
    });*/

});
