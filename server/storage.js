
var gcloud = require('gcloud');
var config = require('../config/config.js');

module.exports = {
    getBucketHandle: getBucketHandle,
    getPublicUrl: getPublicUrl,
    uploadFileToBucket: uploadFileToBucket
};

function getBucketHandle(strBucket, env) {
    var googleProject = config.bucketToProject[strBucket];

    // GCE is running from a different location than root.  It can't find the .json keys in ./ like it could if grunt
    // were running this in the root web directory so the config file is branched on the environment.

    var projectAuths = config.gcloud[env];
    var storage = gcloud.storage(projectAuths[googleProject]);
    return storage.bucket(strBucket);
}

function getPublicUrl(strBucket, filepath) {
    return 'https://' + strBucket + '.storage.googleapis.com/' + filepath;
}

/* The following functions can probably be refactored into FORGE module functions or
 * server level helper modules
 */
function uploadFileToBucket(bucketHandle, localPath, bucketPath, cb) {
    var options = {
        destination: bucketPath,
        validation: 'crc32c'
    };
    bucketHandle.upload(localPath, options, cb);
}

