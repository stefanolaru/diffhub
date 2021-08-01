const Test = require("./lib/entities/test");

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
        // case "GET":
        //     if (event.pathParameters.id) {
        //         // get project
        //         response.body = await Project.get(id)
        //             .then()
        //             .catch((err) => {
        //                 return {
        //                     message: err,
        //                 };
        //             });
        //     } else {
        //         // list the projects here
        //         // later !!
        //     }
        //     break;

        case "POST":
            console.log(JSON.parse(event.body));
            await Test.create(JSON.parse(event.body))
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

        // case "PATCH":
        //     await Project.update(
        //         event.pathParameters.id,
        //         JSON.parse(event.body)
        //     )
        //         .then((res) => {
        //             response.body = res;
        //         })
        //         .catch((err) => {
        //             response.statusCode = 400;
        //             response.body = {
        //                 message: err,
        //             };
        //         });
        //     break;

        case "DELETE":
            await Test.delete(event.pathParameters.id)
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
