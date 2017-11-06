
var fs = require('fs');

module.exports = function(app){
    /**
     * Removing these so that they can't be run on the production environment.  Uncomment to use, then re-comment
     * before commit.
     */
    app.get('/tests', function (req, res) {
            res.render('SpecRunner', null );
            });

    app.get('/', function (req, res) {
        res.render('scratch', {} );
    });

    app.get('/local/:model', function (req, res) {
        var filename = req.params.model;
        var forgeParams = {
            storageRoot: "/models/",
            modelName: filename,
            initialParameterWeights: JSON.stringify({})
        };
        res.render('index', forgeParams );
    });

    // https://console.developers.google.com/m/cloudstorage/b/troveup-dev-private/o/models/atom_ring_vol.json
    app.get('/bucket/:model', function (req, res) {
        var filename = req.params.model;
        var forgeParams = {
            storageRoot: "https://storage.googleapis.com/troveup-dev-private/models/",
            modelName: filename,
            initialParameterWeights: JSON.stringify({})
        };
        res.render('index', forgeParams );
    });

    /**
     * Crashes the production server due to the path.  Not a necessary component.  Commenting out.
     */
    // convert to half edges, count boundaries and fill holes
    app.get('/', function(req, res) {
            fs.readFile('/home/ian/dev/forge/test-server/public/models/parted_ring.json', 'utf8', function (err, data) {
                if (err) throw err;
                var model = JSON.parse(data);
                res.render('index', model);
                });
            });

    //Used in testing the error handling system
    app.get('/throwerror', function(request, response) {
        throw new Error("Test error!");
    });
};

