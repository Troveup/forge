
module.exports = (function(){
    var that = {};

    // callback(prop, val)
    // FIXME: replace this with calls to Object.keys(obj).map(function(key){ /* do stuff with obj[key]; */ })
    var eachProperty = function(hash, callback) {
        Object.keys(hash).map(function(hashProp){
            callback(hashProp, hash[hashProp]);
        });
    };

    var objKeysToArray = function(obj, keyProperty) {
        var arrayOfValues = [];
        eachProperty(obj, function(key, val) {
            arrayOfValues.push(key );
        });
        return arrayOfValues;
    };

    that.eachProperty = eachProperty;
    that.objKeysToArray = objKeysToArray;
    return that;
})();

