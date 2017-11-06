
var Control = require('../../lib/forge/Control');

describe("Control Module", function() {

    /* define arrays of generic testing control and operator nodes to be reset before each spec
     * test. Each test will slice a subset of the original arrays to pass to the constructor and
     * modify the objects before instantiating the graph
     **/

    var operatorList, controlList;
    var opCount = 5;

    beforeEach(function(){
        operatorList = [];
        controlList = []
        for (var i = 1; i <= 5; i++) {
            operatorList.push({
                "id": "Operator_"+i,
                "type": "morph",
                "mesh": "Sample_Mesh",
                "parameters": {
                    "modifiedCount": 1,
                    "indices": [0],
                    "displacements": [0, 1, 0],
                }
            });
        }
        for (i = 1; i <= 5; i++) {
            controlList.push({
                "id": "Control_"+i,
                "label": "Control "+i+" Label",
                "children": [],
                "inputFunc": "average",
                "outputFunc": "direct"
            });
        }
    });

    it("should export a function", function() {
        expect(Control).toBeDefined();
        expect(Control.createGraph).toBeDefined();
        expect(typeof Control.createGraph === 'function').toBeTruthy();
    });

    it("create single operator graph", function() {
        var singleOperator = operatorList.slice(0,1);

        var simpleGraph = Control.createGraph(singleOperator, null);

        expect(simpleGraph).toBeDefined();
        var expectedOperator = {
            Operator_1: 0.0
        };

        expect(simpleGraph.getRootValues()).toEqual(expectedOperator);
        expect(simpleGraph.getLeafValues()).toEqual(expectedOperator);

        simpleGraph.setRootValues({ "Operator_1": 0.25 });
        expectedOperator['Operator_1'] = 0.25;

        var leafValues = simpleGraph.getLeafValues();
        expect(leafValues).toEqual(expectedOperator);
    });

    it("create a multiple operator graph", function() {
        var threeOps = operatorList.slice(0,3);
        var simpleGraph = Control.createGraph(threeOps, null);

        expect(simpleGraph).toBeDefined();
        expect(simpleGraph.getRootValues()).toEqual({
            Operator_1: 0.0,
            Operator_2: 0.0,
            Operator_3: 0.0
        });
        expect(simpleGraph.getLeafValues()).toEqual({
            Operator_1: 0.0,
            Operator_2: 0.0,
            Operator_3: 0.0
        });

        simpleGraph.setRootValues({ "Operator_1": 0.25 });
        expect(simpleGraph.getLeafValues()).toEqual({
            Operator_1: 0.25,
            Operator_2: 0.0,
            Operator_3: 0.0
        });
    });

    it("create one control masking one operator graph", function() {
        var singleOperator = operatorList.slice(0,1);
        var singleControl = controlList.slice(0,1);
        singleControl[0].children = [ "Operator_1" ];

        var simpleGraph = Control.createGraph(singleOperator, singleControl);
        expect(simpleGraph).toBeDefined();

        simpleGraph.propagateRootValues();
        expect(simpleGraph.getRootValues()).toEqual({
            Control_1: 0.0
        });
        expect(simpleGraph.getLeafValues()).toEqual({
            Operator_1: 0.0
        });

        simpleGraph.setRootValues({ "Control_1": 0.25 });

        var leafValues = simpleGraph.getLeafValues();
        expect(leafValues).toEqual({
            Operator_1: 0.25
        });
    });

    it("create one control with two child operators", function() {
        var twoOperators = operatorList.slice(0,2);
        var singleControl = controlList.slice(0,1);
        singleControl[0].children = [ "Operator_1", "Operator_2" ];

        var simpleGraph = Control.createGraph(twoOperators, singleControl);
        expect(simpleGraph).toBeDefined();

        simpleGraph.propagateRootValues();
        expect(simpleGraph.getRootValues()).toEqual({
            Control_1: 0.0
        });
        expect(simpleGraph.getLeafValues()).toEqual({
            Operator_1: 0.0,
            Operator_2: 0.0
        });

        simpleGraph.setRootValues({ "Control_1": 0.25 });

        expect(simpleGraph.getLeafValues()).toEqual({
            Operator_1: 0.25,
            Operator_2: 0.25
        });
    });

    it("use combinewithinverse output function", function() {
        var twoOperators = operatorList.slice(0,2);
        var singleControl = controlList.slice(0,1);
        singleControl[0].children = [ "Operator_1", "Operator_2" ];
        singleControl[0].outputFunc = "combinewithinverse";

        var simpleGraph = Control.createGraph(twoOperators, singleControl);

        simpleGraph.setRootValues({ "Control_1": 0.0 });
        expect(simpleGraph.getLeafValues()).toEqual({
            Operator_1: 1,
            Operator_2: 0
        });

        simpleGraph.setRootValues({ "Control_1": 0.25 });
        expect(simpleGraph.getLeafValues()).toEqual({
            Operator_1: 0.5,
            Operator_2: 0
        });

        simpleGraph.setRootValues({ "Control_1": 0.50 });
        expect(simpleGraph.getLeafValues()).toEqual({
            Operator_1: 0,
            Operator_2: 0
        });

        simpleGraph.setRootValues({ "Control_1": 0.75 });
        expect(simpleGraph.getLeafValues()).toEqual({
            Operator_1: 0,
            Operator_2: 0.5
        });

        simpleGraph.setRootValues({ "Control_1": 1 });
        expect(simpleGraph.getLeafValues()).toEqual({
            Operator_1: 0,
            Operator_2: 1
        });
    });

    it("use inverse output function", function() {
        var twoOperators = operatorList.slice(0,2);
        var singleControl = controlList.slice(0,1);
        singleControl[0].children = [ "Operator_1", "Operator_2" ];
        singleControl[0].outputFunc = "inverse";

        var simpleGraph = Control.createGraph(twoOperators, singleControl);

        simpleGraph.setRootValues({ "Control_1": 0.0 });
        expect(simpleGraph.getLeafValues()).toEqual({
            Operator_1: 1,
            Operator_2: 1
        });

        simpleGraph.setRootValues({ "Control_1": 0.5 });
        expect(simpleGraph.getLeafValues()).toEqual({
            Operator_1: 0.5,
            Operator_2: 0.5
        });

        simpleGraph.setRootValues({ "Control_1": 1 });
        expect(simpleGraph.getLeafValues()).toEqual({
            Operator_1: 0,
            Operator_2: 0
        });
    });

    it("use inverse output function", function() {
        var twoOperators = operatorList.slice(0,2);
        var singleControl = controlList.slice(0,1);
        singleControl[0].children = [ "Operator_1", "Operator_2" ];
        singleControl[0].outputFunc = "inverse";

        var simpleGraph = Control.createGraph(twoOperators, singleControl);

        simpleGraph.setRootValues({ "Control_1": 0.0 });
        expect(simpleGraph.getLeafValues()).toEqual({
            Operator_1: 1,
            Operator_2: 1
        });

        simpleGraph.setRootValues({ "Control_1": 0.5 });
        expect(simpleGraph.getLeafValues()).toEqual({
            Operator_1: 0.5,
            Operator_2: 0.5
        });

        simpleGraph.setRootValues({ "Control_1": 1 });
        expect(simpleGraph.getLeafValues()).toEqual({
            Operator_1: 0,
            Operator_2: 0
        });
    });

    describe("should work with bar ring controls", function() {
        var barOperators = [
            {
                "id": "Prism Width",
                "type": "morph",
                "mesh": "main.Bar Ring",
                "parameters": {
                    "modifiedCount": 1,
                    "indices": [0],
                    "displacements": [0,1,0]
                }
            },
            {
                "id": "Prism Depth",
                "type": "morph",
                "mesh": "main.Bar Ring",
                "parameters": {
                    "modifiedCount": 1,
                    "indices": [0],
                    "displacements": [0,1,0]
                }
            },
            {
                "id": "Prism Height",
                "type": "morph",
                "mesh": "main.Bar Ring",
                "parameters": {
                    "modifiedCount": 1,
                    "indices": [0],
                    "displacements": [0,1,0]
                }
            },
            {
                "id": "Width",
                "type": "morph",
                "mesh": "main.Bar Ring",
                "parameters": {
                    "modifiedCount": 1,
                    "indices": [0],
                    "displacements": [0,1,0]
                }
            }
        ];

        var testGraph = Control.createGraph(barOperators, null);

        it("should have built a valid graph", function() {
            expect(testGraph).toBeDefined();

            var calculatedLeafValues = testGraph.getLeafValues();
            testGraph.propagateRootValues();
            expect(testGraph.getRootValues()).toEqual({
                "Prism Width": 0,
                "Prism Depth": 0,
                "Prism Height": 0,
                "Width": 0
            });
            expect(testGraph.getLeafValues()).toEqual({
                "Prism Width": 0,
                "Prism Depth": 0,
                "Prism Height": 0,
                "Width": 0
            });

            testGraph.setRootValues({
                "Prism Width": 0.5,
            });
            expect(testGraph.getLeafValues()).toEqual({
                "Prism Width": 0.5,
                "Prism Depth": 0,
                "Prism Height": 0,
                "Width": 0
            });
        });
    });


    describe("should have no problems with the warrior ring graph", function() {

        var warriorControls = [
            {
                "id": "Slide.Down",
                "label": "Edge Two",
                "group": "Taper",
                "children": [ "Front.Down.Top", "Front.Down.Bottom" ],
                "inputFunc": "average",
                "outputFunc": "direct"
            },
            {
                "id": "Slide.Up",
                "label": "Edge One",
                "group": "Taper",
                "children": [ "Front.Up.Top", "Front.Up.Bottom" ],
                "inputFunc": "average",
                "outputFunc": "direct"
            },
            {
                "id": "Compress.Back",
                "label": "Compress",
                "group": "Back",
                "min": 0,
                "max": 0.25,
                "children": [ "Back.Down.Top", "Back.Up.Bottom" ],
                "inputFunc": "average",
                "outputFunc": "direct"
            },
            {
                "id": "Stretch.Back",
                "label": "Stretch",
                "group": "Back",
                "children": [ "Back.Up.Top", "Back.Down.Bottom" ],
                "inputFunc": "average",
                "outputFunc": "direct"
            }
        ];

        var warriorOperators = [
            {
                "id": "Front.Up.Top",
                "type": "morph",
                "mesh": "main.Warrior_Ring",
                "parameters": {
                    "modifiedCount": 1,
                    "indices": [0],
                    "displacements": [0, 1, 0],
                }
            },
            {
                "id": "Front.Up.Bottom",
                "type": "morph",
                "mesh": "main.Warrior_Ring",
                "parameters": {
                    "modifiedCount": 1,
                    "indices": [0],
                    "displacements": [0, 1, 0],
                }
            },
            {
                "id": "Front.Down.Top",
                "type": "morph",
                "mesh": "main.Warrior_Ring",
                "parameters": {
                    "modifiedCount": 1,
                    "indices": [0],
                    "displacements": [0, 1, 0],
                }
            },
            {
                "id": "Front.Down.Bottom",
                "type": "morph",
                "mesh": "main.Warrior_Ring",
                "parameters": {
                    "modifiedCount": 1,
                    "indices": [0],
                    "displacements": [0, 1, 0],
                }
            },
            {
                "id": "Back.Up.Top",
                "type": "morph",
                "mesh": "main.Warrior_Ring",
                "parameters": {
                    "modifiedCount": 1,
                    "indices": [0],
                    "displacements": [0, 1, 0],
                }
            },
            {
                "id": "Back.Up.Bottom",
                "type": "morph",
                "mesh": "main.Warrior_Ring",
                "parameters": {
                    "modifiedCount": 1,
                    "indices": [0],
                    "displacements": [0, 1, 0],
                }
            },
            {
                "id": "Back.Down.Top",
                "type": "morph",
                "mesh": "main.Warrior_Ring",
                "parameters": {
                    "modifiedCount": 1,
                    "indices": [0],
                    "displacements": [0, 1, 0],
                }
            },
            {
                "id": "Back.Down.Bottom",
                "type": "morph",
                "mesh": "main.Warrior_Ring",
                "parameters": {
                    "modifiedCount": 1,
                    "indices": [0],
                    "displacements": [0, 1, 0],
                }
            }
        ];

        var testGraph = Control.createGraph(warriorOperators, warriorControls);

        it("should have built a valid graph", function() {
            expect(testGraph).toBeDefined();

            var activeRootValues = {
                "Slide.Down": 0,
                "Slide.Up": 0,
                "Compress.Back": 0,
                "Stretch.Back": 0
            };
            var activeLeafValues = {
                "Front.Up.Top": 0,
                "Front.Up.Bottom": 0,
                "Front.Down.Top": 0,
                "Front.Down.Bottom": 0,
                "Back.Up.Top": 0,
                "Back.Up.Bottom": 0,
                "Back.Down.Top": 0,
                "Back.Down.Bottom": 0
            };

            var calculatedLeafValues = testGraph.getLeafValues();
            testGraph.propagateRootValues();
            expect(testGraph.getRootValues()).toEqual(activeRootValues);
            expect(testGraph.getLeafValues()).toEqual(activeLeafValues);

            activeRootValues["Stretch.Back"] = 0.25;
            testGraph.setRootValues(activeRootValues);

            activeLeafValues["Back.Up.Top"] = 0.25;
            activeLeafValues["Back.Down.Bottom"] = 0.25;
            expect(testGraph.getLeafValues()).toEqual(activeLeafValues);
        });
    });

    describe("should have no problems with: atom ring graph", function() {
        var atomRingOperators = [
            {
                "id": "operator_ring_two_width",
                "label": "Ring Width",
                "groupID": "ring_two___ring___other",
                "groupLabel": "Other",
                "type": "morph",
                "mesh": "ring_two___ring",
                "minWeight": 0.200000,
                "maxWeight": 1.000000,
                "parameters": {
                    "modifiedCount": 0,
                    "indices": [],
                    "displacements": []
                }
            },
            {
                "id": "operator_ring_one_width",
                "label": "Ring Width",
                "groupID": "ring_one___ring___other",
                "groupLabel": "Other",
                "type": "morph",
                "mesh": "ring_one___ring",
                "minWeight": 0.200000,
                "maxWeight": 1.000000,
                "parameters": {
                    "modifiedCount": 0,
                    "indices": [],
                    "displacements": []
                }
            }
        ];

        var testGraph = Control.createGraph(atomRingOperators, []);
        it("should have built a valid graph", function() {
            testGraph.setRootValues({
                operator_ring_two_width: 0.0,
                operator_ring_one_width: 0.0
            });
            expect(testGraph.getLeafValues()).toEqual({
                operator_ring_two_width: 0.0,
                operator_ring_one_width: 0.0
            });
            expect(testGraph.getMappedOperatorValues()).toEqual({
                operator_ring_two_width: 0.2,
                operator_ring_one_width: 0.2
            });

            testGraph.setRootValues({});
            testGraph.getMappedOperatorValues();

        });
    });

});
