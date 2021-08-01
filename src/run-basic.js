const Test = require("./lib/entities/test"),
    runner = require("./lib/runner-basic");

// temp function
exports.handler = async (event) => {
    //
    console.log("Basic test run.");
    // no test id, stop
    if (!event.test_id) return false;

    // get the test from the DB
    const test = await Test.get(event.test_id)
        .then((res) => res)
        .catch((err) => {
            console.log(err);
            return false;
        });

    // if no test, stop
    if (!test) return false;

    // great we have a test to run
    const results = await runner
        .run(test.steps)
        .then((res) => res)
        .catch((err) => {
            console.log(err);
            return false;
        });

    console.log(results);

    return true;
};
