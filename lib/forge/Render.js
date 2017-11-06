
var THREE = require('custom-three');
var Render = module.exports;

Render.create = function(configHash){
    return {
        activeMaterial: null,
        activeShapeways: null,
        fallbackMaterial: null,
        validMaterials: {},
        getMaterial: getMaterial,
        updateCamera: updateCamera,
        initCamera: initCamera,
        initThree: initThree,
        changeItemRadius: changeItemRadius,
        triggerRender: triggerRender,
        changeMaterial: changeMaterial,
        requestScreenshot: requestScreenshot,
        addSizeModePlane: addSizeModePlane,
        setupSizingMode: setupSizingMode,
        toggleSizeMode: toggleSizeMode,
        removeModelMesh: removeModelMesh,
        addModelMesh: addModelMesh,
        screenshots: {},
        meshGroup: null
    };
}

function triggerRender() {
    var that = this;
    that.threeRenderer.render( that.threeScene, that.threeCamera );
}

function updateCamera() {
    var that = this;
    that.trackballControls.update();
}

function initThree(width, height, canvasElem, cubemapRoot) {
    var that = this;

    that.threeScene = new THREE.Scene();
    that.meshGroup = new THREE.Group();
    that.threeScene.add(that.meshGroup);

    //var axisHelper = new THREE.AxisHelper( 50 );
    //that.threeScene.add( axisHelper );

    that.threeRenderer = new THREE.WebGLRenderer({
        canvas: canvasElem,
        antialias: true,
        preserveDrawingBuffer : true, // required to support .toDataURL()
        alpha: true
    });

    that.initCamera({
        focal: 75,
        aspect: width / height,
        near: 0.1,
        far: 1000,
        rendererElement: that.threeRenderer.domElement,

        // for orthographic
        width: width,
        height: height
    });

    // old light, struggled to get good results
    //var hemiLight = new THREE.HemisphereLight( 0xffffff, 0x777777, 1);
    //that.threeScene.add(hemiLight);

    var pointLight = new THREE.PointLight( 0xffffff, 1, 100 );
    pointLight.position.set( -20, -20, -20 );
    that.threeScene.add( pointLight );

    var ambientLight = new THREE.AmbientLight( 0xcccccc );
    that.threeScene.add( ambientLight );

    // order matters for reflection map, helper script picks confusing numerical order
    var urlFiles = [ '0004', '0002', '0006', '0005', '0001', '0003' ];
    var urls = urlFiles.map(function(fileNumber){
        return cubemapRoot?cubemapRoot:'' + '/resources/img/cubemaps/light-studio/' + fileNumber + '.png';
    });
    var cubemap = THREE.ImageUtils.loadTextureCube(urls); // load textures

    fallbackMaterial = new THREE.MeshNormalMaterial();
    that.validMaterials.gold = new THREE.MeshPhongMaterial({
        color: 0xF5D779,
        envMap: cubemap,
        combine: THREE.MultiplyOperation,
        reflectivity: .8,
        shading: THREE.SmoothShading
    });
    that.validMaterials.brass = new THREE.MeshPhongMaterial({
        color: 0xFAE696,
        envMap: cubemap,
        combine: THREE.MultiplyOperation,
        reflectivity: .8,
        shading: THREE.SmoothShading
    });
    that.validMaterials.silver = new THREE.MeshPhongMaterial({
        color: 0xFCFAF5,
        envMap: cubemap,
        combine: THREE.MultiplyOperation,
        reflectivity: .8,
        shading: THREE.SmoothShading
    });
    that.validMaterials.rosegold = new THREE.MeshPhongMaterial({
        color: 0xFFADAD, 
        envMap: cubemap,
        combine: THREE.MultiplyOperation,
        reflectivity: .7,
        shading: THREE.SmoothShading
    });
};

function initCamera(opts) {
    var that = this;
    that.threeCamera = new THREE.PerspectiveCamera( opts.focal, opts.aspect, opts.near, opts.far );
    // that.threeCamera = new THREE.OrthographicCamera( opts.width / - 2, opts.width / 2, opts.height / 2, opts.height / - 2, 1, 1000 );

    that.trackballControls = new THREE.TrackballControls( that.threeCamera, opts.rendererElement ); 
    that.trackballControls.noPan = true;
    that.trackballControls.dynamicDampingFactor = 0.1;
    that.trackballControls.rotateSpeed = 3.0;
    that.trackballControls.zoomSpeed = 0.6;

    that.threeCamera.position.set(-10, 10, 10);
    that.threeCamera.lookAt(new THREE.Vector3(0,0,0));

    if (opts.radius) {
        that.changeItemRadius(opts.radius, true);
    }
}

function changeItemRadius(radius, updatePosition) {
    var that = this;

    var oldMin = that.trackballControls.minDistance;
    var oldMax = that.trackballControls.maxDistance;
    var newMin = radius * 1.5;
    var newMax = radius * 4.5;

    // don't allow new zoom interval to force a camera move
    newMin = oldMax < newMin ? oldMax : newMin;
    newMax = oldMin > newMax ? oldMin : newMax;
    
    that.trackballControls.minDistance = newMin;
    that.trackballControls.maxDistance = newMax;

    if (updatePosition) {
        that.threeCamera.position.setLength(radius * 3.5);
        that.threeCamera.lookAt(new THREE.Vector3(0,0,0));
    }
}

function requestScreenshot(canvasElem, label) {
    var that = this;

    if (that.screenshots[label]) {
        return that.screenshots[label];
    }

    var base64 = canvasElem.toDataURL('image/png');
    that.screenshots[label] = base64;

    return base64;
}

// TODO: scale initial model properly
// offset model position in sizing mode to be on neckline

function setupSizingMode(screenWidth, screenHeight) {
    var that = this;

    that.oldCameraMatrix = new THREE.Matrix4();
    that.inspectPosition = new THREE.Vector3(0, 0, 30);

    var halfAngle = (that.threeCamera.fov * Math.PI) / (360); // converted to radians
    var halfEdge = Math.tan(halfAngle) * that.inspectPosition.length(); // assume target of camera is at origin
    that.sideLength = halfEdge*2;
    that.addSizeModePlane(that.sideLength);

    // scale object so it appears proportional with the background plane
    var imageWorldHeight = 388.55148; // the real world height of the image (in mm) if we assume head height of 22cm
    that.sizingScalar = that.sideLength  / imageWorldHeight;

    // that.necklineOffset = new THREE.Vector3(0, halfEdge * -0.5, 0); // factor here ranges from [0,1], maps from no offset to bottom of plane
    that.storedMaxDistance = Infinity;
    that.planeMesh.visible = false
    that.sizeModeActive = false;
}

function addSizeModePlane(side) {
    var that = this;
    var imgURL = require('./sizing-background-necklace.jpg');
    var texture = THREE.ImageUtils.loadTexture( imgURL );
    that.planeMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(side, side, 0),
        new THREE.MeshBasicMaterial({ map: texture })
    );
    that.threeScene.add(that.planeMesh);
}

var previewMinScrollScale = 0.1;
var previewMidScrollScale = 0.3;
var previewMaxScrollScale  = 0.4;

function toggleSizeMode() {
    var that = this;
    that.sizeModeActive = !that.sizeModeActive;
    if (that.sizeModeActive) {
        that.planeMesh.visible = true

        that.trackballControls.saveCurrentState();
        that.trackballControls.reset();

        that.storedMinDistance = that.trackballControls.minDistance;
        that.storedMaxDistance = that.trackballControls.maxDistance;
        that.trackballControls.minDistance = that.sideLength * previewMinScrollScale;
        that.trackballControls.maxDistance = that.sideLength * previewMaxScrollScale;

        
        that.meshGroup.scale.multiplyScalar(that.sizingScalar);
        that.threeCamera.position.copy(that.inspectPosition).setLength(that.sideLength * previewMidScrollScale);

        that.trackballControls.noRotate = true;
        that.trackballControls.noPan = true;
    } else {
        that.planeMesh.visible = false

        that.trackballControls.minDistance = that.storedMinDistance;;
        that.trackballControls.maxDistance = that.storedMaxDistance;

        that.meshGroup.scale.divideScalar(that.sizingScalar);

        that.trackballControls.noRotate = false;
        that.trackballControls.noPan = false;
        that.trackballControls.restoreState();
    }
}

function removeModelMesh(meshID) {
    var that = this;
    if (meshID) {
        var oldActive = that.meshGroup.getObjectByName(meshID);
        if (oldActive) that.meshGroup.remove(oldActive);
    }
}

function addModelMesh(threeMesh) {
    var that = this;
    threeMesh.material = that.activeMaterial;
    that.meshGroup.add(threeMesh);
}

/* Material */

var getMaterial = function() {
    var that = this;
    return that.activeMaterial;
}

var changeMaterial = function(newMaterialID) {
    var that = this;

    newMaterialID = newMaterialID.toLowerCase();
    if (!that.validMaterials[newMaterialID]) {
        console.log("FORGE Error: No material found with ID "+newMaterialID);
        return;
    }
    that.activeMaterial = that.validMaterials[newMaterialID];
}

/* ArcBall coordinate conversions, investigate for more intuitive controls */

/**
 * When the user presses a button, we note where on the arcball the user clicked 
 * and store it in the rot_start vector. We also disable spinning while the user is rotating the scene.
 */ 
//void mousePressed() {
    //ROTATION_FLAG = false;
    //rot_start = computeSphereVector(mouseX, mouseY);            
//}


/**
 * As the user drags the button, we compute the arc and the corresponding quaternion.
 * The new arc corresponds to the change in mouse coordinates since the last computation; thus,
 * the path of the mouse on the screen as it is dragged will consist of many little arcs.
 *
 * We also disable spinning if the user clicks the left mouse button.
 */
//void mouseDragged(){
    //rot_end = computeSphereVector(mouseX, mouseY); //compute where on the arcball the mouse ended up;

    //delta_quaternion = new Quaternion(PVector.dot(rot_start,rot_end),rot_start.cross(rot_end)); //compute the corresponding quaternion;

    //current_quaternion = delta_quaternion.mult(current_quaternion);  
    //rot_start = rot_end;                                             

    //if (mouseButton != RIGHT) ROTATION_FLAG = false;                   
//}

/**
 * This method computes the projection of the user click at (x,y) onto the unit 
 * hemishpere facing the user (aka "the arcball"). The ball is centered in the 
 * middle of the screen and has radius equal to gizmoR. All clicks outside this radius
 * are interpreted as being on the boundary of the disk facing the user.
 *
 * To compute pX and pY (x and y)coordinates of the projection, we subtract the center of the sphere
 * and scale down by gizmoR.
 * Since the projection is on a unit sphere, we know that pX^2 + pY^2 + pZ^2 = 1, so we can compute
 * the Z coordinate from this formula. This won't work if pX^2 + pY^2 > 1, i.e. if the user clicked
 * outside of the ball; this is why we interpret these clicks as being on the  boundary.
 */ 
//PVector computeSphereVector(int x, int y){
    //float gizmoR = width/4.0;           //set the radius of the arcball

    //float pX = (x-width/2.0)/gizmoR;    
    //float pY = (y-height/2.0)/gizmoR;
    //float L2 = pX*pX + pY*pY;
    //if (L2>=1) {
        //PVector ans = new PVector(pX, pY, 0); 
        //ans.normalize(); //interpret the click as being on the boundary
        //return ans;
    //} else {
        //float pZ = sqrt(1 - L2); 
        //return new PVector(pX, pY, pZ);
    //}  
//} 
