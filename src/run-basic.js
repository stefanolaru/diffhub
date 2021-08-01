const Test = require("./lib/entities/test"),
    Log = require("./lib/entities/log"),
    runner = require("./lib/runner-basic");

// basic test function
// we assume what got here was previously checked by the triggering function
exports.handler = async (event) => {
    //
    console.log("Basic test run.", event);

    // update log

    // console.log(results);

    return log;
};
