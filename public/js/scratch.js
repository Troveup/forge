
var WIDTH = 300;
var HEIGHT = 400;
var scene, camera, renderer;

var defaultMaterial = new THREE.MeshPhongMaterial( { color: 0x00ff00 } );
var lineMaterial = new THREE.LineBasicMaterial( { color : 0xff0000 } );
var pointsMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });

function calculateDimensions() {
    var edge = WIDTH > HEIGHT ? HEIGHT : WIDTH;
    var halfAngle = (75 * Math.PI) / (360); // cut fov in half and convert to radians
    var planeRadius = Math.tan(halfAngle) *  60;
    return planeRadius * 2;
}

function init() {
    setupScene();
    var side = calculateDimensions();
    var texture = THREE.ImageUtils.loadTexture( '/resources/img/necklace-silhouette-outline-test.png' );
    var backgroundMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(side, side, 0),
        // new THREE.PlaneGeometry(92.079, 92.079, 0),
        new THREE.MeshBasicMaterial({ map: texture })
    );
    scene.add(backgroundMesh);
    // console.log(camera.position);
    
    render();
}

function textTest() {
    var geo = generateBentText("hi");
    renderPoints(geo.vertices);
    var mesh = wrapAndAdd(geo, pointsMaterial);
}

function generateBentText(text, opts) {
    opts = {} || opts;
    opts.size = opts.size || 10;
    opts.height = opts.height || 5;

    var textGeo = new THREE.TextGeometry( text, opts );
    textGeo.computeBoundingBox();





    var path = new THREE.CurvePath();
    var curve = createCurve();
    path.add(curve);
    renderCurve(curve);





    deformToPath(textGeo.vertices, textGeo.boundingBox, path);

    return textGeo;
}

function renderCurve(curve) {
    var geometry = new THREE.Geometry();
    geometry.vertices = curve.getPoints( 50 );
    var curveObject = new THREE.Line( geometry, lineMaterial );
    scene.add(curveObject);
}

function Bendable(text, path, parameters) {
    parameters = parameters || {};

	var size = parameters.size !== undefined ? parameters.size : 100;
	var curveSegments = parameters.curveSegments !== undefined ? parameters.curveSegments : 4;

	var font = parameters.font !== undefined ? parameters.font : 'helvetiker';
	var weight = parameters.weight !== undefined ? parameters.weight : 'normal';
	var style = parameters.style !== undefined ? parameters.style : 'normal';

	THREE.FontUtils.size = size;
	THREE.FontUtils.divisions = curveSegments;

	THREE.FontUtils.face = font;
	THREE.FontUtils.weight = weight;
	THREE.FontUtils.style = style;


	var data = THREE.FontUtils.drawText( text );
    var textBounds = getPathSetBounds(data.paths);

    // var allPoints = extractPoints(data.paths);

    deformToPath(allPoints, textBounds, path);
    renderPoints(allPoints, 'point');

    var textShapes = pathsToShapes(data.paths)
    parameters.amount = parameters.height !== undefined ? parameters.height : 50;

    if ( parameters.bevelThickness === undefined ) parameters.bevelThickness = 10;
    if ( parameters.bevelSize === undefined ) parameters.bevelSize = 8;
    if ( parameters.bevelEnabled === undefined ) parameters.bevelEnabled = false;

    var geo = new THREE.ExtrudeGeometry( textShapes, parameters );

    return geo;
}

function renderPoints(pointSet, method) {
    method = method || 'point';

    if (method == "point") {
        for (var i = 0, il = pointSet.length; i < il; i++) {
            var p = pointSet[i];
            var mesh = new THREE.Mesh(new THREE.SphereGeometry( .5, 6, 6 ), defaultMaterial)
            mesh.position.set(p.x, p.y, p.z);
            scene.add(mesh);
        }
    } else {
        var geometry = new THREE.Geometry();
        for (var i = 0, il = pointSet.length; i < il; i++) {
            geometry.vertices.push(pointSet[i]);
        }
        var line = new THREE.Line( geometry, lineMaterial )
        scene.add(line);
    }
}

// safe wraparound iterative accessing [i + 1 % il]


function extractPoints(pathList) {
    var points = [];
    for (var i = 0, il = pathList.length; i < il; i++) {
        var path = pathList[i];
        for (var j = 0, jl = path.curves.length; j < jl; j++) {
            var c = path.curves[j];
            points.push(new THREE.Vector3(c.v1.x, c.v1.y, 0));
        }
        // var pathPoints = pathList[i].getPoints(100);
		// Array.prototype.push.apply( points, pathPoints );
    }
    return points;
}

// @oldPts - the points to deform, can be from multiple paths
// @bounds - the bounding box dimensions of the original combined points, used for determining scale in original position
// @path - the path to deform the points against
function deformToPath(oldPts, bounds, curve) {
	var i, il, p, oldX, oldY, xNorm;
	for ( i = 0, il = oldPts.length; i < il; i ++ ) {

		p = oldPts[ i ];

		oldX = p.x;
		oldY = p.y;

		xNorm = oldX / bounds.max.x;

		// If using actual distance, for length > curve, requires line extrusions
		//xNorm = curve.getUtoTmapping(xNorm, oldX); // 3 styles. 1) wrap stretched. 2) wrap stretch by arc length 3) warp by actual distance
		xNorm = curve.getUtoTmapping( xNorm, oldX );

		var pathPt = curve.getPoint( xNorm );
		var normal = curve.getTangent( xNorm );
		normal.set( - normal.y, normal.x ).multiplyScalar( oldY );

		p.x = pathPt.x + normal.x;
		p.y = pathPt.y + normal.y;
	}

	return oldPts;
}

function mapPathsOntoCurve(paths, bounds, curve) {
	var i, il, j, jl, p, oldX, oldY, xNorm;
	for ( i = 0, il = paths.length; i < il; i ++ ) {
		path = paths[ i ];
        for (j = 0, jl = path.curves.length; j < jl; j++) {
        }
	}
}

function getPathSetBounds(pathCollection){
    //console.log("Path Collection");
    //console.log(pathCollection);

	var maxX, maxY, maxZ;
	var minX, minY, minZ;
	maxX = maxY = maxZ = Number.NEGATIVE_INFINITY;
	minX = minY = minZ = Number.POSITIVE_INFINITY;

	var p, i, il, sum, v3;

    for (var j = 0, jl = pathCollection.length; j < jl; j++) {

        var path = pathCollection[j];
        var points = path.getPoints();

        v3 = points[ 0 ] instanceof THREE.Vector3;

        for ( i = 0, il = points.length; i < il; i ++ ) {

            p = points[ i ];

            if ( p.x > maxX ) maxX = p.x;
            else if ( p.x < minX ) minX = p.x;

            if ( p.y > maxY ) maxY = p.y;
            else if ( p.y < minY ) minY = p.y;

            if ( v3 ) {

                if ( p.z > maxZ ) maxZ = p.z;
                else if ( p.z < minZ ) minZ = p.z;

            }
        }
    }

    return {
        max: new THREE.Vector3(maxX, maxY, maxZ),
        min: new THREE.Vector3(minX, minY, minZ)
    };
}

function pathsToShapes(paths) {
	var shapes = [];
	for ( var p = 0, pl = paths.length; p < pl; p ++ ) {
		Array.prototype.push.apply( shapes, paths[ p ].toShapes() );
	}
	return shapes;
}

function wrapAndAdd(geo, mat) {
    mat = mat || defaultMaterial;
    var mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    return mesh;
}

function testMesh() {
    var textMesh = createTextMesh("Hello");
    scene.add(textMesh);

    var extents = new THREE.Vector3();
    var max = textMesh.geometry.boundingBox.max;
    var min = textMesh.geometry.boundingBox.min;
    extents.subVectors(max, min);
    console.log(extents);
}

function setupScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera( 75, WIDTH / HEIGHT, 0.1, 1000 );
    camera.position.z = 60;
    var controls = new THREE.OrbitControls( camera );

    renderer = new THREE.WebGLRenderer();
    document.body.appendChild( renderer.domElement );
    renderer.setSize( WIDTH, HEIGHT );

    var light = new THREE.AmbientLight( 0x404040 ); // soft white light
    scene.add( light );

    var directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
    directionalLight.position.set( 0, 1, 1 );
    scene.add( directionalLight );

    var axisHelper = new THREE.AxisHelper( 50 );
    scene.add( axisHelper );
}

function createCurve() {
    // var curve = new THREE.SplineCurve3( [
    var curve = new THREE.CatmullRomCurve3( [
        new THREE.Vector3( -20, 0, 0 ),
        new THREE.Vector3( -10, 3, 0 ),
        new THREE.Vector3( 0,  0, 0 ),
        new THREE.Vector3( 10, 0, 0 ),
        new THREE.Vector3( 20, 0, 0 )
    ]);

    return curve;
}

function createTextMesh(text) {
    var opts = {
        size: 20,
        height: 10 // more like thickness, size is the text height
    };

    var material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
    var textGeo = new THREE.TextGeometry( text, opts );
    textGeo.computeBoundingBox();
    textGeo.computeVertexNormals();

    return new THREE.Mesh(textGeo, material);
}

var render = function () {
    requestAnimationFrame( render );
    renderer.render(scene, camera);
};

init();
