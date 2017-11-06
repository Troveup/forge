
var cluster = require('cluster');

//Single master process whose entire job is to spawn off new child workers to answer
//requests.  This is its code path.
if (cluster.isMaster) {
    var numCPUs = require('os').cpus().length;
    console.log('Inside master process, spawning '+ numCPUs +' children...');

    for (var i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    // Listen for dying workers
    cluster.on('exit', function (worker, code, signal) {
        console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
        cluster.fork();
    });

    // TODO: create a shutdown endpoint for graceful server restart
    process.on('SIGINT', function() {
        console.log('Caught a Ctrl+C event, time to kill the children..');

        var wid, workerIds = [];
        for(wid in cluster.workers) {
            workerIds.push(wid);
        }

        workerIds.forEach(function(wid) {
            if (cluster.workers[wid]) {
                cluster.workers[wid].kill('SIGKILL');
            }
        });

        console.log("All of the kids are dead.  Goodbye, cruel world.");
        process.exit();
    });

} else { //Child worker code path that answers web requests.
    var app = require('./app.js')();
}

