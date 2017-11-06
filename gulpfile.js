var gulp = require('gulp');
var webpack = require('webpack');
var path = require('path');
var fs = require('fs');
var DeepMerge = require('deep-merge');
var forever = require('forever-monitor');


// REMOVE
var nodemon = require('nodemon');
// END REMOVE

var webpackConfig = require('./config/webpackConfig.js');

/* Build setup borrows heavily from the guide by James Long:
 * http://jlongster.com/Backend-Apps-with-Webpack--Part-I
 */

var cfg = require('./config/config.js');
var foreverMonitor;

var deepmerge = DeepMerge(function(target, source, key) {
    if(target instanceof Array) {
        return [].concat(target, source);
    }
    return source;
});

// generic

var defaultConfig = {
    addVendor: function (name, path) {
        this.resolve.alias[name] = path;
        this.module.noParse.push(new RegExp(path));
    },
};

if (process.env.NODE_ENV !== 'production') {
    defaultConfig.devtool = '#eval-source-map';
    defaultConfig.debug = true;
}

function config(overrides) {
    return deepmerge(defaultConfig, overrides || {});
}

var frontendConfig = config(webpackConfig['frontend']);

// backend
var nodeModules = {};
fs.readdirSync('node_modules').filter(function(x) {
    return ['.bin'].indexOf(x) === -1;
}).forEach(function(mod) {
    nodeModules[mod] = 'commonjs ' + mod;
});

var backendConfig = config(webpackConfig['backend']);
backendConfig.externals = nodeModules;

var combinedConfig = [ frontendConfig, backendConfig ];

function onBuild(done) {
    return function(err, stats) {
        if(err) {
            console.log('Error', err);
        } else {
            console.log(stats.toString());
        }

        if(done) {
            done();
        }
    }
}

gulp.task('frontend-build', function(done) {
    webpack(frontendConfig).run(onBuild(done));
});

gulp.task('frontend-watch', function() {
    webpack(frontendConfig).watch(100, onBuild());
});

gulp.task('backend-build', function(done) {
    webpack(backendConfig).run(onBuild(done));
});

gulp.task('backend-watch', function() {
    webpack(backendConfig).watch(100, function(err, stats) {
        onBuild()(err, stats);
    });
});

gulp.task('frontend', ['frontend-watch'], function(done) {
    var child = new(forever.Monitor)('build/FORGE-server.js', {
        silent: false,
        max: Number.POSITIVE_INFINITY,
        watch: true,
        watchDirectory: 'build',    // Top-level directory to watch from.
        watchIgnoreDotFiles: true,  // whether to ignore dot files
        watchIgnorePatterns: []
    });

    child.on('restart', function() {
        console.log('triggered restart event on forever server!');
    });

    child.on('exit', function () {
        console.log('forever '+scriptFile+' has exited');
    });
});

gulp.task('server', ['backend-watch'], function(done) {
    var child = new(forever.Monitor)('build/FORGE-server.js', {
        silent: false,
        max: Number.POSITIVE_INFINITY,
        watch: true,
        watchDirectory: 'build',    // Top-level directory to watch from.
        watchIgnoreDotFiles: true,  // whether to ignore dot files
        watchIgnorePatterns: []
    });

    child.on('restart', function() {
        console.log('triggered restart event on forever server!');
    });

    child.on('exit', function () {
        console.log('forever '+scriptFile+' has exited');
    });
});

gulp.task('export', function(done){
    frontendConfig.output = {
        library: 'FORGE',
        path: cfg.exportPath,
        filename: 'FORGE.js'
    },
    webpack(frontendConfig).run(onBuild(done));
});

gulp.task('watch', function(){
    webpack(combinedConfig).watch(100, function(err, stats) {
        onBuild()(err, stats);
    });
});
