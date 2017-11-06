
module.exports = (function(){
    var THREE = require('three');
    THREE["OBJExporter"] = require('./OBJExporter');
    THREE["TrackballControls"] = require('./TrackballControls');

    return THREE;
})();
