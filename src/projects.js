const Project = require("./lib/entities/project");

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
                response.body = await Project.get(event.pathParameters.id)
                    .then()
                    .catch((err) => {
                        return {
                            message: err,
                        };
                    });
            } else {
                // get the list of projects
                response.body = await Project.list()
                    .then()
                    .catch((err) => {
                        return {
                            message: err,
                        };
                    });
            }
            break;

        case "POST":
            // console.log(JSON.parse(event.body));
            await Project.create(JSON.parse(event.body))
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

        case "PATCH":
            await Project.update(
                event.pathParameters.id,
                JSON.parse(event.body)
            )
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
            await Project.delete(event.pathParameters.id)
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
