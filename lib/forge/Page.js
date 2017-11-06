
var Util = require('forge/Util');
var Scene = require('forge/Scene');
var Render = require('forge/Render');

// add these functions to the page module (which could be a singleton if desired)

module.exports = (function(){
    var that = {};

    var exportURL = "/savenewmodel";

    var troveScene;
    var renderWrapper;

    var timerVar;
    var csrfToken = null;

    var troveWorker;
    var SLIDE_DURATION = 1000, // time for initial slide, in milliseconds
        SLIDE_RESOLUTION = 30;

    function getTime() {
		return performance !== undefined && performance.now !== undefined ? performance.now() : Date.now();
    }

    var runTest = function(operatorIDs) {
        var i, startTime, finishTime, sequentialTime, simultaneousTime;
        var numSteps = 10;

        // start out with all operators at zero value
        var weights = operatorIDs.reduce(function(prev, curr){
            prev[curr] = 0
            return prev;
        }, {});
        troveScene.readNormalizedRootValues(weights);
        troveScene.propagateValuesToGeometry();

        // sequential test
        startTime = getTime();
        operatorIDs.map(function(operatorID){
            for (i = 0; i < numSteps; i++) {
                weights[operatorID] = i/numSteps;
                troveScene.readNormalizedRootValues(weights);
                troveScene.propagateValuesToGeometry();
            }
        });
        finishTime = getTime();
        sequentialTime = finishTime - startTime;

        // reset weights for next test
        operatorIDs.map(function(operatorID){
            weights[operatorID] = 0;
        });
        troveScene.readNormalizedRootValues(weights);
        troveScene.propagateValuesToGeometry();

        // simultaneous test
        startTime = getTime();
        for (i = 0; i < numSteps; i++) {
            operatorIDs.map(function(operatorID){
                weights[operatorID] = i/numSteps;
            });
            troveScene.readNormalizedRootValues(weights);
            troveScene.propagateValuesToGeometry();
        }
        finishTime = getTime();
        simultaneousTime = finishTime - startTime;
        console.log("sequentialTime", sequentialTime,"simultaneousTime", simultaneousTime);
    };

    var runRepeatedTests = function() {
        var allOperatorIDs = [];
        Object.keys(troveScene.sceneMeshes).forEach(function(meshID) {
            var mesh = troveScene.sceneMeshes[meshID];
            allOperatorIDs = allOperatorIDs.concat(Object.keys(mesh.operators))
        });

        runTest(allOperatorIDs);
    };

    // parse initial configuration and setup FORGE on page
    var init = function(initConfig, controlsRenderedCallback) {
        resetClock();

        if (isMobile()) {
            // TODO: probably need some custom handling for this case
        }

        // bucket param overrides storageRoot, and an empty string should be pruned to make room for the default
        if (initConfig.bucket) {
            initConfig.storageRoot = "https://storage.googleapis.com/"+initConfig.bucket+"/models/";
        } else if (initConfig.storageRoot == "") {
            delete initConfig.storageRoot;
        }

        var defaultConfig = { // The first object sets defaults, and is overwritten by `initConfig`
            selectors: {                                 
                materialSelect: "#webmenu",
                modelParentID: "#modelParentID",
                initialParamsBlock: "#initialParameters",
                canvas: "#canvas"
            },
            storageRoot: "https://storage.googleapis.com/troveup-qa-cdn/models/",
            defaultMaterial: "1 98", // Gold - 18k Gold
            width: 550,
            height: 400,
            isFTUE: false,
            debug: false,
            workerSourcePath: "/resources/js/priceworker.js",
            cubemapRoot: ""
        };

        var cfg = $.extend(defaultConfig, initConfig);
        troveScene = Scene.create(cfg); // must be called before

        renderWrapper = Render.create();
        renderWrapper.initThree(troveScene.getConfig("width"), troveScene.getConfig("height"), select("canvas")[0], troveScene.getConfig("cubemapRoot"));
        troveScene.setRenderWrapper(renderWrapper);

        // disable this for now to remove dependency, will probably put it back when worker script can be packaged with library
        if (false && window.Worker) {
            console.warn("Make sure config is pointing to correct worker js path");
            troveWorker = new Worker(cfg.workerSourcePath);
            troveWorker.addEventListener('message', handleWorkerResponse, false);
        }

        populateScene(renderWrapper, controlsRenderedCallback);
    };

    var setupMaterials = function () {
        var $materialSelect = select("materialSelect");
        if (!$materialSelect.length) {
            console.log("FORGE Info: Material select doesn't exist on page, creating with hardcoded forge options.");
            createMaterialSelect();
            $materialSelect = select("materialSelect");
        }

        var defaultMaterial = troveScene.getConfig("defaultMaterial")
        setMaterialSelection(defaultMaterial);

        $materialSelect.change(function(){
            var selected = $materialSelect.find('option:selected');
            renderWrapper.changeMaterial(selected.data('forge'));
            troveScene.updateMeshMaterials();
            restartPriceFetch();
        });
    }

    var getModelURL = function() {
        return troveScene.getConfig("storageRoot") + troveScene.getConfig("activeFilename")
    };

    function buildControlContext(templates) {
        var meshes = troveScene.sceneMeshes;
        var context = { renderChannels: [] };
        var tempRenderChannels = [];

        Object.keys(meshes).map(function(meshID){
            var mesh = meshes[meshID];
            if (mesh.spec.channelLabel == 'static-objects') {
                return;
            }

            // add channel to context if it doesn't exist
            var channelIndex = _.findIndex(tempRenderChannels, function(renderChannel) {
                return renderChannel.id == mesh.spec.channelID;
            });
            if (channelIndex < 0) {
                tempRenderChannels.push({
                    id: mesh.spec.channelID,
                    label: mesh.spec.channelLabel,
                    meshes: []
                });
                channelIndex = tempRenderChannels.length - 1;
            }

            // sort mesh operators into control groups
            var controlGroups = troveScene.controlGraph.getControlGroups();
            var meshControlGroups = _.filter(controlGroups, function(elem) {
                return elem.mesh == meshID;
            });

            meshControlGroups = meshControlGroups.map(function(group){
                var groupControls = group.controlIDs.map(function(controlID){
                    var node = troveScene.controlGraph.allNodes[controlID];
                    var controlContext = {
                        id: node.id,
                        label: node.label
                    };
                    return templates[node.templateKey](controlContext);
                });

                return {
                    name: group.label,
                    controls: groupControls
                };
            });

            var channelObj = tempRenderChannels[channelIndex]
            channelObj.meshes.push({
                id: mesh.id,
                label: mesh.spec.label,
                controlGroups: meshControlGroups
            });
        });

        if (tempRenderChannels.length == 1) {
            context.singleChannel = true;
        }
        for (var i = 0, il = tempRenderChannels.length; i < il; i++) {
            var chan = tempRenderChannels[i];
            var numMeshes = chan.meshes.length;
            var sortedMeshes = _.sortBy(chan.meshes, function(iterMesh) {
                return iterMesh.label;
            });
            chan.meshes = sortedMeshes;
            if (numMeshes <= 1) {
                chan.channelSelector = "";
            } else if (numMeshes <= 3) {
                chan.channelSelector = templates['controlChannelRadio'](chan);
            } else {
                chan.channelSelector = templates['controlDropdown'](chan);
            }

            for (var j = 0, jl = numMeshes; j < jl; j++) {
                var m = chan.meshes[j];
                if (m.controlGroups.length == 1) {
                    m.singleGroup = true;
                }
            }

            if ((numMeshes > 1) || (chan.meshes[0] && chan.meshes[0].controlGroups.length > 0)) {
                context.renderChannels.push(chan);
            }
        }
        return context;
    }
        
    // use config to build link to model, load into scene
    var populateScene = function(renderWrapper, controlsRenderedCallback) {
        var modelURL = getModelURL();

        // not sure why this is true, unimportant now
        var printDebug = troveScene.getConfig("debug");
        if (printDebug) {
            clockEvent("Starting load of: "+modelURL);
        }

        $.getJSON(modelURL, function(modelJSON) {
            if (troveWorker) {
                var msg = {
                    cmd: 'load',
                    modelJSON: modelJSON
                };
                troveWorker.postMessage(msg); // [exportHash, modelJsonData]
            }

            setupMaterials();
            troveScene.parseModel(modelJSON);

            // right now this is all loaded on model parse, but setting the scene for integrating
            // all customizer related frontend being centralized through scss and templates
            // var styles = require('./customizer.scss');
            var otherStyles = require('./control-toggle.scss');

            var templates = compileTemplates();
            var controlContext = buildControlContext(templates);
            renderControlBox(templates['controlBox'], controlContext);

            if (controlsRenderedCallback != null) {
                controlsRenderedCallback();
            }

            renderWrapper.changeItemRadius(troveScene.getConfig("itemRadius"), true);

            // IM: should fold this into general template processing logic, but first this section
            // of html should be built as the output of templates instead of adding listeners to
            // elements that are expected to be on the page
            if (troveScene.getConfig("category") == "necklace") {
                var WIDTH = troveScene.getConfig("width");
                var HEIGHT = troveScene.getConfig("height");
                renderWrapper.setupSizingMode(WIDTH, HEIGHT);

                // frontend changes
                var sizeContainer = $('.item-size-container');
                if (sizeContainer.length) {
                    var sizeSelectionDiv = sizeContainer.find('.item-size');
                    var toggleHtml = templates['controlToggle']({});

                    if (sizeSelectionDiv.length) {
                        sizeSelectionDiv.hide();
                        sizeSelectionDiv.after(toggleHtml);
                    } else {
                        sizeContainer.append(toggleHtml);
                    }
                }

                // next two lines tell customizer and control html to switch to sizing mode state
                renderWrapper.toggleSizeMode();
                $('#myonoffswitch')[0].checked = true; // this is confusing, looks like maybe we associated css with wrong state?

                $('#myonoffswitch').change(function(){
                    renderWrapper.toggleSizeMode();

                    if (!renderWrapper.sizeModeActive) {
                        troveScene.updateModelRadius();
                        renderWrapper.changeItemRadius(troveScene.getConfig("itemRadius"), false);
                    }
                });
            }

            window.addEventListener('resize', handleResize, false);

            $('.spinner.controls').hide();
            $('.spinner.shape').hide();

            renderLoop();
            handleResize();
        }).done(function(){
            clockEvent("Successfully loaded model data");
        }).fail(function(){
            console.log("FORGE Error: Failed to load model JSON from URL");
        });
    };

    function renderLoop() {
        processFrameCallbacks();
        requestAnimationFrame( renderLoop );
        renderWrapper.updateCamera();
        renderWrapper.triggerRender();
    }

    // waits 2 seconds then requests the updated price 
    var fetchPriceDelayed = function() {
        timerVar = setTimeout(triggerPriceFetch, 2000);
    };

    var setCSRFToken = function(token) {
        csrfToken = token;
    };

    // TODO: consolidate these functions for generating the export hash
    /**
     * Exports the raw exportHash for use with other efforts.  Currently only used with volume calculation using web
     * workers.
     *
     * @param materialValue The scene's currently selected material
     * @param sizeValue The size of the item that is being exported.
     * @returns {{jsonUrl, modelName: *, exportBucket: *, material: *, visible: *, operators: *, volume: *, exportPath: string, includeNormals: boolean}}
     */
    var generateExportHash = function(sizeValue, materialValue) {
        var visible = Util.objKeysToArray(troveScene.getActives());
        var operators = troveScene.getOperatorsForExport();
        var modelName = troveScene.getConfig("activeFilename");
        var exportHash = {
            jsonUrl: getModelURL(),
            modelName: modelName,
            exportBucket: troveScene.getConfig("bucket"),
            visible: visible,
            operators: operators,
            exportPath: 'exports/'+modelName
        };

        return exportHash;
    };

    var addExportHash = function(formData, sizeValue, materialValue) {
        var visible = Util.objKeysToArray(troveScene.getActives());

        // FIXME: cache a measurement of the volume so we're ready to add it to the export hash whenever
        //Removing volume calculation for now, as it is a computationally heavy operation and mobile devices dislike it.
        //var volume = troveScene.figureVolume();
        var operators = troveScene.getOperatorsForExport();
        var modelName = troveScene.getConfig("activeFilename");
        var exportHash = {
            jsonUrl: getModelURL(),
            modelName: modelName,
            exportBucket: troveScene.getConfig("bucket"),
            material: materialValue,
            visible: visible,
            operators: operators,
            //volume: volume,
            exportPath: 'exports/'+modelName,
            includeNormals: true
        };

        var jewelryCategory = troveScene.getConfig("category");
        exportHash.size = jewelryCategory+"_"+sizeValue;

        formData.append("exportHash", JSON.stringify(exportHash));
    };

    var exportModel = function(addToBag) {
        clockEvent("Starting Export...");

        var modelExportData = new FormData();
        var keys = []; // FIXME: delete this dumb debug thing if I don't need it immediately

        // FIXME: move this into scene
        addBagData(modelExportData);
        addMeshData(modelExportData);
        addExportHash(modelExportData, $("#size").val(), getShapewaysMaterial());

        modelExportData.append("shouldAddToCart", addToBag); // add to bag directly, or save to trove for later
        modelExportData.append("imageExtension", ".jpg");
        modelExportData.append("engraveText", $("#engravetext").val());

        var screenshotLabel = "image-0";
        var screenData = renderWrapper.requestScreenshot(select("canvas")[0], screenshotLabel);
        modelExportData.append(screenshotLabel, screenData);

        jQuery.ajax({
            url: exportURL,
            data: modelExportData,
            cache: false,
            contentType: false,
            processData: false,
            headers: {
                'Access-Control-Allow-Origin': '*',
                "X-CSRF-TOKEN": csrfToken
            },
            type: 'POST',
            success: function(data){},
            failure: function(data){}
        });
    };

    var logFormKeys = function(form, keys) {
        keys.map(function(key) {
            var values = form.getAll(key);
            for (var i = 0; i < values.length; i++) {
                console.log(key +" [index "+i+"] : "+values[i]);
            }
        });
    };

    // gets fired everytime the material dropdown value changes and when any slider value slides 1 unit
    // cancels the stale fetchPriceDelayed call if its inside of the 2 second window and sends a fresh priceEstimate request
    var restartPriceFetch = function() {
        setPriceDisplay('Appraising...');
        clearTimeout(timerVar);

        fetchPriceDelayed();
    };

    var updateTrove = function() {
        exportModel(false);

        var newcount = parseInt($('.tallyho-profile').html()) + 1;
        $('#button_addToTrove span').text(' Troved');
        $('#bump').addClass('opaa');
        setTimeout(function() {
            $('#bump').removeClass('opaa');
        }, 2000);
    };

    var updateCart = function() {
        exportModel(true);
        // document.getElementById('#button_addToBag span').onclick = null;
        var newcount = parseInt($('.tallyho-profile').html()) + 1;
        $('#button_addToBag span').text(' Added');
        $('#bump2').addClass('opaa');
        setTimeout(function() {
            $('#bump2').removeClass('opaa');
        }, 2000);
    };

    // the "materialID finishID" combo corresponding to a shapeways purchase option
    var getShapewaysMaterial = function() {
        var materialSelectInput = select("materialSelect")[0];
        return materialSelectInput[materialSelectInput.selectedIndex].value;
    };
    
    var getMaterialInfo = function() {
        var materialSelectInput = select("materialSelect")[0];
        var mat = materialSelectInput[materialSelectInput.selectedIndex].value.split(" ");
        return {
            activeThree: null, // FIXME would be nice if this were accurate
            shapeways: {
                material: mat[0],
                finish: mat[1]
            }
        };
    };

    var handleWorkerResponse = function(e) {
        var data = e.data;

        switch (data.type) {
            case 'model-volume':
                requestPriceEstimate(data.volume);
                break;
            case 'debug':
                console.log(data.msg);
                break;
        }
    };

    var triggerPriceFetch = function() {
        var defaultHash = generateExportHash();
        if (troveWorker) {
            var msg = {
                cmd: 'volume',
                exportHash: defaultHash
            };
            troveWorker.postMessage(msg);
        } else {
            var volume = troveScene.getModelVolume(defaultHash.visible, defaultHash.operators);
            requestPriceEstimate(volume);
        }
    };

    /* Feeds information about the current model configuration to the backend to get a price
     * estimate, volume is required as an argument but otherwise defaults will be determined from
     * the scene state
     */
    var requestPriceEstimate = function(volume) {

        if (!renderWrapper.sizeModeActive) {
            // FIXME: total hack to have this rendering related code in the price update func, but this is the most sensible hacky location
            troveScene.updateModelRadius();
            renderWrapper.changeItemRadius(troveScene.getConfig("itemRadius"), false);
        }

        readMaterialSelection();
        var materialInfo = getMaterialInfo();

        var data = new FormData();
        data.append("parentItemId", document.getElementById("modelParentID").textContent);
        data.append("materialId", materialInfo.shapeways.material);
        data.append("finishId", materialInfo.shapeways.finish);
        data.append("volume", volume);

        setPriceDisplay('Appraising...');
        jQuery.ajax({
            url: '/customizerpriceestimate',
            data: data,
            cache: false,
            contentType: false,
            processData: false,
            headers: {
                'Access-Control-Allow-Origin': '*',
                "X-CSRF-TOKEN": csrfToken
            },
            type: 'POST',
            success: function(data) {
                setPriceDisplay(data.estimate);
            }
        }).fail(function(err){
            console.log("FORGE Error: Failed to update graphical customized price estimate");
        });

    };

    var isMobile = function(){
        return /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(navigator.userAgent) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(navigator.userAgent.substr(0,4));
    };

    // parameter is of form:  materialID +" "+finishID
    var setMaterialSelection = function(materialFinish) {
        var $materialSelect = select("materialSelect");
        if (!$materialSelect.length) {
            console.log("FORGE Error: Cannot find HTML element for material selector.");
            renderWrapper.changeMaterial("gold");
            return;
        }

        $materialSelect.val(materialFinish);
        $('#webmenu-button span').html($('#webmenu option:selected').text());
        readMaterialSelection();
    };

    var readMaterialSelection = function(){
        var $materialSelect = select("materialSelect");
        var shapewaysMaterialFinish = $materialSelect.val();
        var forgeMaterial = $materialSelect.find("option:selected").data("forge");
        if (!forgeMaterial) {
            forgeMaterial = "gold";
        }
        renderWrapper.changeMaterial(forgeMaterial);
    };

    var addMeshData = function(exportData) {
        exportData.append("modelExtension", ".obj");

        var appendedIDs = {}; // use this to prevent double exporting operators directly added as slider nodes
        // or, could simply export slider and operator values separately (probably should update to this)

        Util.eachProperty(troveScene.controlGraph.getRootValues(), function(sliderID, sliderValue) {
            exportData.append("modelWeight-"+sliderID, sliderValue);
            appendedIDs[sliderID] = true;
        });

        var currentValues = troveScene.controlGraph.getLeafValues();
        Util.eachProperty(currentValues, function(operatorID, operatorValue) {
            if (appendedIDs[operatorID]) return;
            exportData.append("modelWeight-"+operatorID, operatorValue);
        });
    };
    
    var handleResize = function() {
        $canvasContainer = $(troveScene.getConfig("canvasContainerSelector"));
        if (!$canvasContainer.length) {
            setDimensions(troveScene.getConfig("width"), troveScene.getConfig("height")); // just user whatever is in the seetings
            return;
        }

        var x = $canvasContainer.width();
        var y = $canvasContainer.height();
        setDimensions(x, y);
    };

    function setDimensions(x, y) {
        renderWrapper.threeRenderer.setSize( x, y );
        var cam = renderWrapper.threeCamera;
        cam.aspect = x / y ;
        cam.updateProjectionMatrix();

        troveScene.setConfig("width", x);
        troveScene.setConfig("height", y);
    }

    function stopResize() {
        window.removeEventListener('resize', handleResize);
    }

    var addBagData = function (exportData) {
        var $materialSelect = select("materialSelect");
        var materialInfo = $materialSelect.val().split(" ");
        var chainSelect = $('#chain');
        exportData.append("modelMaterial", materialInfo[0]);
        exportData.append("modelMaterialFinish", materialInfo[1]);

        if (chainSelect.val())
            exportData.append("chain", chainSelect.val());

        var category = troveScene.getConfig("category");
        var sizeDropdown = $("#size");
        if (sizeDropdown && sizeDropdown.val()) {
            exportData.append("size", sizeDropdown.val().replace(' ', '-').toLowerCase());
        }

        //The parent model from which this model originated, expecting this exact identifier
        var modelParentID = document.getElementById("modelParentID").textContent;
        exportData.append("parentModelId", modelParentID);

        var name = $('#view').html();
        var description = $('#view2').html();

        exportData.append("modelName", name);
        exportData.append("modelDescription", description);
        exportData.append("isPrivate", true); // FIXME: not sure what this does
    };

    function selectInitialMeshes(meshList) {
        for (var i = 0, il = meshList.length; i < il; i++) {
            var meshID = meshList[i];
            var mesh = troveScene.sceneMeshes[meshID];
            var channelID = mesh.spec.channelID;

            $('select.uninitialized-dropdown[data-name="'+channelID+'"]').val(mesh.spec.label);
            $('.channelSelectRadio[data-channelID="'+channelID+'"][data-meshID="'+meshID+'"]').attr("checked", "checked");
            channelSwitch(channelID, meshID);
        }

        $("select.uninitialized-dropdown").selectmenu('refresh', true);
        $("input[type='radio']").checkboxradio("refresh");
    }

    var fetchInitialParams = function(useDebugData) {
        var $paramBlock = select("initialParamsBlock");
        var succeeded = false;
        var response = { visible: [], operators: [] };
        if ($paramBlock.length && !useDebugData) {
            try {
                response = JSON.parse($paramBlock.html())
            } catch(e) {
                console.log('Failed parsing initial weights, error received: ' + e);
            }
        }
        response.visible = response.visible || [];
        response.operators = response.operators || [];

        if (useDebugData) {
            response = {"visible":["primary___heartbeat_ring"],"operators":[{"id":"spike_left","value":"0"},{"id":"spike_center","value":"1"},{"id":"spike_right","value":"0"},{"id":"primary___heartbeat_ring___other___down_right_primary___heartbeat_ring","value":"1"},{"id":"primary___heartbeat_ring___other___up_right_primary___heartbeat_ring","value":"0"},{"id":"primary___heartbeat_ring___other___down_left_primary___heartbeat_ring","value":"1"},{"id":"primary___heartbeat_ring___other___up_left_primary___heartbeat_ring","value":"0"},{"id":"primary___heartbeat_ring___other___down_center_primary___heartbeat_ring","value":"0"},{"id":"primary___heartbeat_ring___other___up_center_primary___heartbeat_ring","value":"1"}]};
        }

        return response;
    };

    var readInitialWeights = function readInitialWeights() {
        var initialParams = fetchInitialParams();
        applyInitialWeights(initialParams.operators);
        selectInitialMeshes(initialParams.visible);
    };

    var select = function(selectionQuery) {                                    
        var $pageSelect = $(troveScene.getConfig("selectors")[selectionQuery]);
        return $pageSelect;
    };                                                                         

    var createMaterialSelect = function() {
        var materialSelections = [
            { shapeways: "1 98", webgl: "gold", text: "Gold - 18k Gold"},
            { shapeways: "1 91", webgl: "gold", text: "Gold - 14k Gold"},
            { shapeways: "1 96", webgl: "rosegold", text: "Gold - 14k Rose Gold"},
            { shapeways: "1 97", webgl: "silver", text: "Gold - 14k White Gold"},
            { shapeways: "2 81", webgl: "silver", text: "Silver - Premium"},
            { shapeways: "3 112", webgl: "gold", text: "Precious Plated - 18k Gold Plated"},
            { shapeways: "3 110", webgl: "gold", text: "Precious Plated - 14k Gold Plated"},
            { shapeways: "3 111", webgl: "rosegold", text: "Precious Plated - 14k Rose Gold Plated"},
            { shapeways: "3 113", webgl: "silver", text: "Precious Plated - Rhodium Plated"},
            { shapeways: "4 85", webgl: "gold", text: "Brass - Polished"},
            { shapeways: "5 87", webgl: "rosegold", text: "Bronze - Polished"}
        ];

        var $materialSelect = $('<select>').attr("name", "webmenu").attr("id", "webmenu").addClass("matter form-control ignore");
        materialSelections.map(function(mat){
            $materialSelect.append($('<option>') .attr("value", mat.shapeways) .attr("data-forge", mat.webgl) .text(mat.text));
        });

        $('#options').append($materialSelect);
    };

    function webglAvailable() {
        try {
            var canvas = document.createElement( 'canvas' );
            return !!( window.WebGLRenderingContext && (
                canvas.getContext( 'webgl' ) ||
                    canvas.getContext( 'experimental-webgl' ) )
                    );
        } catch ( e ) {
            return false;
        }
    }

    function compileTemplates() {
        var templates = {};
        templates['controlBox'] = Handlebars.compile(require('raw!forge/control-box.hbs'));
        templates['controlSlider'] = Handlebars.compile(require('raw!forge/control-slider.hbs'));
        templates['controlDropdown'] = Handlebars.compile(require('raw!forge/control-dropdown.hbs'));
        templates['controlToggle'] = Handlebars.compile(require('raw!forge/control-toggle.hbs'));
        templates['controlChannelRadio'] = Handlebars.compile(require('raw!forge/control-channelRadio.hbs'));
        return templates;
    }

    // build all sliders, save into nodeID keyed index
    // read initial weight parameters, calculate individual displacements
        // if empty displacement, do some sort of flicker
    // based on start time and ttl, move each slider a fraction of displacement scaled by delta time
        // event triggers shouldn't be active, update sliders and model scene directly
    // after displacements are set properly, attach listeners and trigger rotation

    // HERE: make each control a partial
    function renderControlBox(controlBoxTemplate, templateContext) {

        var html = controlBoxTemplate(templateContext);
        var $controls = $("#controls");
        $controls.empty();
        $controls.append(html);

        var controlNodes = {};

        $(".uninitialized-dropdown").each(function(){
            var dropdownElement = $(this);
            dropdownElement.change(onDropdownChange);
        });

        var $sliderHandles = $(".uninitialized-slider");
        var numSliders = $sliderHandles.length;
        var completedSliders = 0;

        $sliderHandles.each(function(){
            var sliderElement = $(this);
            var nodeID = sliderElement.data("name");
            var node = troveScene.controlGraph.allNodes[nodeID];

            sliderElement.removeClass("uninitialized-slider");

            var slider = sliderElement[0];
            noUiSlider.create(slider, {
                start: node.initial,
                step: 1,
                range: {
                    'min': 0,
                    'max': 100
                },
                format: {
                    to: function (value) {
                        return String(Math.round(value));
                    },
                    from: function ( value ) {
                        return Number(value);
                    }
                }
            });

            var elem = $(slider);

            controlNodes[nodeID] = {
                slider: slider,
                sliderName: elem.attr('data-name'),
                handler: function(values, handle) {

                    var update = {};
                    update[elem.attr('data-name')] = values[handle];

                    var rootIDs = troveScene.controlGraph.getRootValues();
                    Object.keys(rootIDs).map(function(slideID) { // ignore the stored value, not based on sliders
                        update[slideID] = getSliderValue(slideID);
                    });
                    restartPriceFetch();

                    troveScene.readInputValues(update);
                    troveScene.propagateValuesToGeometry();
                }
            };

            // changes to the numeric input also trigger the slider onSet handler
            var $numericInput = sliderElement.prevAll(".slideinput:first");
            if ($numericInput.length) {
                // $slider.Link('lower').to($numericInput);
                var input = $numericInput[0];
                slider.noUiSlider.on('update', function(values, handle) {
                    input.value = values[handle];
                });
                input.addEventListener('change', function(){
                    slider.noUiSlider.set(this.value);
                });
            }
        });

        var initialParams = fetchInitialParams();
        var initialHash = {};
        initialParams.operators.map(function(op){
            initialHash[op.id] = op.value * 100;
        });

        $(".noUi-origin").addClass("initial");

        setTimeout(function(){
            selectInitialMeshes(initialParams.visible);
            registerFrameCallback({
                frameCB:function(state){
                    var delta = Date.now() - state.start;
                    var fraction = delta / SLIDE_DURATION;

                    Object.keys(controlNodes).map(function(sliderNodeID) {
                        if (typeof initialHash[sliderNodeID] != "undefined") {
                            var cn = controlNodes[sliderNodeID];
                            var target = fraction * initialHash[sliderNodeID]
                            cn.slider.noUiSlider.set(target);

                            var update = {};
                            update[cn.sliderName] = target;

                            var rootIDs = troveScene.controlGraph.getRootValues();
                            Object.keys(rootIDs).map(function(slideID) { // ignore the stored value, not based on sliders
                                update[slideID] = getSliderValue(slideID);
                            });
                            // restartPriceFetch();
                            troveScene.readInputValues(update);
                            troveScene.propagateValuesToGeometry();
                        }
                    });

                },
                haltTest: function(state){
                    var delta = Date.now() - state.start;
                    return delta > SLIDE_DURATION;
                },
                cleanup: function(state) {
                    Object.keys(controlNodes).map(function(sliderNodeID) {
                        var cn = controlNodes[sliderNodeID];
                        cn.slider.noUiSlider.on('slide', cn.handler);
                        cn.slider.noUiSlider.on('set', cn.handler);
                        cn.slider.noUiSlider.set(initialHash[sliderNodeID]);
                    });
                    setTimeout(function() {
                        renderWrapper.trackballControls.startSpin();
                    }, 500);
                    $(".noUi-origin").removeClass("initial");
                },
                state: { start: Date.now() }
            });
        }, 1000);

        $(".channelSelectRadio").each(function(){
            $(this).on("change", handleRadioChange);
        });

        // make sure the mesh actually has the first options active (similar code for dropdowns and radios)
        $(".meshSelectForm:first-child").each(function(){
            var firstRadio = $(this).find(".channelSelectRadio");
            var meta = firstRadio.attr("id").split("::");
            channelSwitch(meta[0], meta[1]);
        });
        $(".uninitialized-dropdown option:selected").each(function() {
            var elem = $(this);
            channelSwitch(elem.data("channel"), elem.data("mesh"));
        });

        $('#webmenu').removeClass('matter form-control ignore'); 

        // $('#size-button span').html('Choose Size');
        // $('#webmenu-button span').html('Choose Material');
        $('.uninitialized-dropdown').selectmenu();
        // FIXME: needs to separately trigger the options card and the control box
        // $('.dropdownWrapper select').trigger('create');
        // $('#sidebar').trigger('create');

        restartPriceFetch();
    }


    /* *******
     * Transplanted Control code
     *********/
    function handleRadioChange(evt) {
        var meta = evt.target.id.split("::");
        channelSwitch(meta[0], meta[1]);
    }

    function channelSwitch(channelID, meshID) {
        troveScene.changeChannelMesh(channelID, meshID);

        var groupControlsQuery = ".renderChannel[data-name=\""+ channelID +"\"] .meshControls";
        var activeMeshControlsQuery = "#meshControls_"+ meshID;

        $(groupControlsQuery).hide();
        $(activeMeshControlsQuery).show();
        troveScene.propagateValuesToGeometry();
        restartPriceFetch();
    }

    function applyInitialWeights(initialWeights) {
        for (var i = 0; i < initialWeights.length; i++) {
            initialWeights[i].value *= 100;
            setSliderValue(initialWeights[i].id, initialWeights[i].value);
        }
    };

    // right now this is hardcoded to handle mesh selection results, should make general to pass
    // results to other functions
    function onDropdownChange(evt) {
        var elem = $(evt.target);

        var optionSelected = elem.find("option:selected");
        var valueSelected = optionSelected.val();
        var textSelected = optionSelected.text();

        var channelID = optionSelected.data('channel');
        var meshID = optionSelected.data('mesh');

        channelSwitch(channelID, meshID);
    }

    // update the stored morph target weight corresponding to the updated slider, then propogate to customizer
    function onSliderChange( values, handle, unencoded, tap ) {
        var elem = $(this);

        var update = {};
        update[elem.attr('data-name')] = values[handle];

        var rootIDs = troveScene.controlGraph.getRootValues();
        Object.keys(rootIDs).map(function(slideID) { // ignore the stored value, not based on sliders
            update[slideID] = getSliderValue(slideID);
        });
        restartPriceFetch();

        troveScene.readInputValues(update);
        troveScene.propagateValuesToGeometry();
    }

    /* Interface for customizer control elements
     */

    function getSliderValue(nodeID) {
        var $slider = $(".noUi-target").filter('[data-name="'+nodeID+'"]');
        if ($slider.length) {
            return $slider[0].noUiSlider.get();
        }
    }

    // triggers slider sync to three js as a side effect
    function setSliderValue(nodeID, value) {
        var $slider = $(".noUi-target").filter('[data-name="'+nodeID+'"]');
        if ($slider.length) {
            var slider = $slider[0];
            slider.noUiSlider.set(value);
        }
    }

    function setPriceDisplay(priceText) {
        var $priceBox = $('.item-price-container .item-price');
        if ($priceBox.length) {
            $priceBox.html(priceText);
        }
    }

    /*function logCameraInfo() {
        var that = this;
        var cam = renderWrapper.threeCamera;

        console.log("Camera position, length:");
        console.log(cam.position);
        console.log(cam.position.length());
    }
    that.logCameraInfo = logCameraInfo;*/

    // TODO plugin system: register events and processes
    // register callbacks that will be passed all the relevant model data
    // can trigger on custom forge events
    // can register a callback and execute it every frame until some condition is met

    var frameCallbacks = [];
    function registerFrameCallback(opts) {
        var cbWrapper = {
            body: opts.frameCB,
            haltTest: opts.haltTest,
            state: opts.state || {},
            cleanup: opts.cleanup || function(){}
        };
        frameCallbacks.push(cbWrapper);
    }

    function processFrameCallbacks() {
        for (var i = 0; i < frameCallbacks.length; i++) {
            var fcb = frameCallbacks[i];
            if (fcb.haltTest(fcb.state)) {
                fcb.cleanup();
                frameCallbacks.splice(i, 1);
            } else {
                fcb.body(fcb.state);
            }
        }
    };

    var tInit;
    var tEvents;
    var showDebug = false;

    function resetClock(msg) {
        tInit = Date.now();
        tEvents = {};
        console.log("=== Clock start time set to: "+tInit);
    }

    function clockEvent(label) {
        var tNow = Date.now();
        var ttEvent = tNow - tInit;
        tEvents[label] = ttEvent;

        if (showDebug) {
            // console.log("=== "+ttEvent/1000 +" >> "+label);
        }
    }

    that.runRepeatedTests = runRepeatedTests;
    that.generateExportHash = generateExportHash;
    that.addExportHash = addExportHash;
    that.addMeshData = addMeshData;
    that.setCSRFToken = setCSRFToken;
    that.init = init;
    that.createMaterialSelect = createMaterialSelect;
    that.setPriceDisplay = setPriceDisplay;
    that.select = select;
    that.handleResize = handleResize;
    that.updateTrove = updateTrove;
    that.updateCart = updateCart;
    that.triggerPriceFetch = triggerPriceFetch;
    that.isMobile = isMobile;
    that.setMaterialSelection = setMaterialSelection;
    that.readMaterialSelection = readMaterialSelection;
    that.readInitialWeights = readInitialWeights;
    that.exportModel = exportModel;
    that.getShapewaysMaterial = getShapewaysMaterial;
    that.restartPriceFetch = restartPriceFetch;
    return that;
})();

