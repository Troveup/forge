
var FORGE = require('forge');
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');
var storage = require('./storage');
var fs = require('fs');
var https = require('https');
var config = require('../config/config.js');
var crypto = require('crypto');
var cors = require('cors');

var appPath = (process.env.PWD == null ? __dirname : process.env.PWD);

var spawn;
var useSync = true;
if (useSync) {
    spawn = require('child_process').spawnSync;
} else {
    spawn = require('child_process').spawn;
}


module.exports = function(){
    var app = express();

    // FIXME: disable for non-debugging purposes
    if (config.debugRoutes) {
        app.use(cors());
    }

    app.set('views', path.join(__dirname, '..', 'views'));
    app.set('view engine', 'jade');

    /* Include the app engine handlers to respond to start, stop, and health checks. */
    app.use(require('appengine-handlers'));
    app.use(express.static('public'));

    app.use(bodyParser.json());

    var server = app.listen(config.port, function () {
        var host = server.address().address;
        var port = server.address().port;

        console.log('Example app listening at http://%s:%s', host, port);
    });

    //Handle errors gracefully and kill the process
    // TODO: determine whether this is conflicting with the process level management tools
    app.use(function(err, req, res, next) {
        try {
            console.error(err.message);
            console.error("Stack Trace -- " + err.stack);
            var killTimer = setTimeout(function () {
                process.exit();
            }, 3000);

            killTimer.unref();

            server.close();

            cluster.worker.disconnect();

            res.status(err.status || 500);
            res.json(
                {
                    message: err.message,
                    error: err.stack,
                    success: false
                });
        } catch (er2) {
            console.error('Problem sending 500 error!', er2.stack);
        }
    });

    /*
     * params:
     * @visible - list of mesh IDs that will be unioned to form the exported OBJ, e.g. ["Parted_Ring", "Accent_Piece"]
     * @size - item size typed by jewelry category, e.g. "ring_6.5"
     * @operators - array of objects with "id" and "value" properties defining operator weights for export
     * @importBucket - the Google Cloud Storage bucket containing the file to download, e.g. "troveup-dev-private"
     * @importPath - starting at the bucket public download root, this component completes the URL for the json model
     * @importUrl - convenience bypass for importBucket + importPath
     * @exportBucket - similar to importBucket
     * @exportPath - similar to importPath
     * @enableRender - whether to include normals and apply textual CSG
     */
    app.post('/api/export', function(request, response) {
        var opts = request.body;
        var storageRoot = "https://storage.googleapis.com/";

	console.log(new Date().toString() + ' -- Export request hash: ' + JSON.stringify(opts)); 

        opts.importBucket = opts.importBucket || "troveup-dev-private";
        opts.exportBucket = opts.exportBucket || "troveup-dev-private";
        opts.modelURL = opts.importUrl || (storageRoot + opts.importBucket + '/' + opts.importPath);
        opts.exportURL = storageRoot + opts.exportBucket + '/' + opts.exportPath;
        opts.visible = opts.visible || [];
        opts.operators = opts.operators || [];
        opts.modelName = path.basename(opts.modelURL);
        opts.enableRender = !!opts.enableRender;

        // the path where blender will deposit the generated OBJ for upload by node
        opts.tempPath = generateTemporaryPath().replace('.json', '.obj');

        // download json file to local temp path
        // TODO: local cache of most used models?
        var exportBucketHandle = storage.getBucketHandle(opts.exportBucket, config.environment); // FIXME: this needs to be based on environment
        var blendResult = execBlenderModule("blendlib", opts);

        storage.uploadFileToBucket(exportBucketHandle, opts.tempPath, opts.exportPath, function(err, file, apiResponse){
            fs.unlinkSync(opts.tempPath);

            var hash = {
                sourceModel: opts.modelName,
                exportURL: opts.exportURL,
                errorCode: blendResult.code,
                success: !err,
                msg: err ? 'Model upload failure with message: ' + err.message : "",
            };
            response.json(hash);
        });
    });

    /**
     * TODO:  Verb doesn't match the action, but passing the data in the POST body makes the most sense.  Find another way?
     */
    app.post('/api/volume', function(request, response) {
        //TODO:  This code was copied from the /api/export endpoint, probably needs to be turned into a function at some point, but its asynchronous nature makes that not as straightforward
        var tempPath = generateTemporaryPath();
        var modelDownload = fs.createWriteStream(tempPath);
        var importURL = request.body.jsonUrl || request.body.importUrl;

        //I'd like to thank http://stackoverflow.com/a/22907134/537454
        https.get(importURL, function(contents){
            contents.pipe(modelDownload);

            modelDownload.on('finish', function() {
                modelDownload.close(function() {
                    var modelContents = fs.readFileSync(tempPath);
                    var exportHash = request.body;
                    var volumeScene = FORGE.Scene.create({
                        activeFilename: exportHash.modelName,
                        enableCSG: false
                    });
                    volumeScene.parseModel(JSON.parse(modelContents.toString()));

                    var visible = !!exportHash.visible ? exportHash.visible : null;
                    var operators = !!exportHash.operators ? exportHash.operators : null;
                    var volume = volumeScene.getModelVolume(visible, operators);

                    fs.unlink(tempPath);
                    response.json({
                        volume: volume,
                        units: 'mm3',
                        success: true
                    });
                });
            });
        }).on('error', function(e){
            response.statusCode = 500;
            response.setHeader('content-type', 'application/json');
            response.json({
                message: "An error was encountered: " + e.message,
                success: false
            });
        });
    });

    // NOTICE: google app engine requires something similar at: '/_ah/health'
    // if this is a requirement of our server environment maybe this function can be moved
    // into the appengine-handlers.js file and renamed
    app.get('/healthcheck', function (req, res) {
        res.json({
            message: 'Still Alive'
        });
    });

    if (config.debugRoutes) {
        require('./routes')(app);
    }

    return app;
};

// NB: synchronous
function execBlenderModule(module, opts) {
    var bigArg = {
        enableRender: opts.enableRender,
        modelURL: opts.modelURL,
        localPath: path.resolve(opts.tempPath),
        size: opts.size,
        visible: opts.visible,
        importBucket: opts.importBucket,
        operators: opts.operators
    };
    var blendArgs = ["--background", "--python", "blender-scripts/"+module+".py", "--", JSON.stringify(bigArg)];
    var execResult = spawn('blender', blendArgs);
    console.log("Output: "+ execResult.stdout);
    console.log("Error: "+execResult.stderr);
    return execResult;
}



function generateTemporaryPath() {
    var guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = crypto.randomBytes(1)[0]%16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });

    return path.join(appPath, 'temp/tempfile-') + guid + ".json";
}

