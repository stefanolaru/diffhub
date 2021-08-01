const Test = require("./lib/entities/test"),
    Log = require("./lib/entities/log");

// temp function
exports.handler = async (event) => {
    //
    console.log("Test Trigger", event);

    const test_id = event.test_id || event.pathParameters.id;

    // no test id, stop
    if (!test_id)
        return response(
            event,
            {
                message: "Test id is missing",
            },
            400
        );

    // get the test from the DB
    const test = await Test.get(test_id)
        .then((res) => res)
        .catch((err) => {
            console.log(err);
            return {
                message: err,
            };
        });

    // if no test, stop
    if (!test.id) return response(event, test, 404);

    // create Log entry
    let log = await Log.create(test.id, event.trigger || "manual")
        .then((res) => res)
        .catch((err) => {
            console.log(err);
            return {
                message: "Log entry could not be created",
            };
        });

    // if no log, stop, usually a server or config issue
    if (!log.id) return response(event, log, 500);

    // invoke the lambda with the test data & log info
    await Test.run(test, log)
        .then((res) => {
            console.log(res);
        })
        .catch((err) => {
            console.log(err);
            return false;
        });

    return response(event, {
        id: log.id,
        created_at: log.created_at,
        test_id: log.test_id,
    });
};

const response = (event, data, statusCode = 200) => {
    // response for the http request
    const response = {
        statusCode: statusCode,
        headers: {
            "Access-Control-Allow-Origin": "*", // Required for CORS support to work
            "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
            "Access-Control-Allow-Methods": "GET,OPTIONS",
        },
        body: data,
    };

    response.body = JSON.stringify(response.body);
    return event.httpMethod ? response : data;
};
