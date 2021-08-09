const Test = require("./lib/entities/test"),
    Project = require("./lib/entities/project");

// projects handler
exports.handler = async (event) => {
    //
    // prepare the response object
    const response = {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*", // Required for CORS support to work
            "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
            "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        },
        body: "",
    };

    switch (event.httpMethod) {
        // get tasks or task
        case "GET":
            if (event.pathParameters && event.pathParameters.id) {
                // get project
                response.body = await Test.get(event.pathParameters.id)
                    .then()
                    .catch((err) => {
                        return {
                            message: err,
                        };
                    });
            } else {
                // list the projects here
                response.body = await Test.list(
                    event.queryStringParameters &&
                        event.queryStringParameters.project_id
                        ? event.queryStringParameters.project_id
                        : null
                )
                    .then()
                    .catch((err) => {
                        return {
                            message: err,
                        };
                    });
            }
            break;

        case "POST":
            var data = JSON.parse(event.body),
                project = null;
            await Project.get(data.project_id)
                .then((res) => {
                    project = res;
                    return Test.create(data);
                })
                .then((res) => {
                    response.body = res;
                    // increment project tests count
                    return Project.update(
                        project.id,
                        {
                            tests_count: project.tests_count + 1,
                        },
                        true
                    );
                })
                .then()
                .catch((err) => {
                    response.statusCode = 400;
                    response.body = {
                        message: err,
                    };
                });
            break;

        case "PATCH":
            await Test.update(event.pathParameters.id, JSON.parse(event.body))
                .then((res) => {
                    response.body = res;
                })
                .catch((err) => {
                    response.statusCode = 400;
                    response.body = {
                        message: err,
                    };
                });
            break;

        case "DELETE":
            await Test.get(event.pathParameters.id)
                .then((item) => {
                    return item.id
                        ? Test.delete(item)
                        : Promise.reject("Test not found.");
                })
                .then((res) => {
                    response.body = res;
                })
                .catch((err) => {
                    response.statusCode = 400;
                    response.body = { message: err };
                });
            break;
    }

    // output the results
    response.body = JSON.stringify(response.body);
    return response;
};
