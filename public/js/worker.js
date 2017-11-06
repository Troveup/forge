
onmessage = function(e) {

    function createExpensiveArray(){
        var someData = [];
        for (var i = 0; i < 10000000; i++) {
            someData[i] = i;
        }
        return someData;
    }

    console.log('Worker is receiving a message: array of length '+ e.data.length);

    console.log('Posting back big array');
    postMessage(createExpensiveArray());
}
