import childProcess from "child_process";
import bills from "./bills.js";

function runScript(scriptPath, args, callback) {

    // keep track of whether callback has been invoked to prevent multiple invocations
    var invoked = false;

    var process = childProcess.fork(scriptPath, args);

    // listen for errors as they may prevent the exit event from firing
    process.on('error', function (err) {
        if (invoked) return;
        invoked = true;
        callback(err);
    });

    // execute the callback once the process has finished running
    process.on('exit', function (code) {
        if (invoked) return;
        invoked = true;
        var err = code === 0 ? null : new Error('exit code ' + code);
        callback(err);
    });

}

const BATCH_SIZE = 100;
const billsLength = bills.length;
const iterations = Math.ceil(billsLength / BATCH_SIZE);
for (let i = 0; i < iterations; i++) {
    const args = ["--batch", BATCH_SIZE, "--offset", i * BATCH_SIZE, "--output", `output_${i}.csv`]
    // Now we can run a script and invoke a callback when complete, e.g.
    runScript('./billScraper.js', args, function (err) {
        if (err) throw err;
        console.log('finished running some-script.js');
    });
}
