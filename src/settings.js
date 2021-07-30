const AWS = require("aws-sdk");

AWS.config.update({
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
});

const ddb = new AWS.DynamoDB();

// function handler
exports.handler = async (event) => {
    //
    // prepare the response object
    const response = {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*", // Required for CORS support to work
            "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        },
        body: "",
    };

    switch (event.httpMethod) {
        // get settings
        case "GET":
            // pull __config from DynamoDB
            response.body = await ddb
                .getItem({
                    TableName: process.env.DDB_TABLE,
                    Key: AWS.DynamoDB.Converter.marshall({
                        id: "__config",
                        created_at: 0,
                    }),
                })
                .promise()
                .then((res) => {
                    return res.Item
                        ? AWS.DynamoDB.Converter.unmarshall(res.Item)
                        : false;
                })
                .catch((err) => {
                    console.log(err);
                    return false;
                });
            break;
        // update settings
        case "POST":
            // get data from the body
            const data = JSON.parse(event.body);

            if (typeof data === "object") {
                // force the id & created_at, add updated_at flag
                Object.assign(data, {
                    id: "__config",
                    created_at: 0,
                    updated_at: Math.round(+new Date() / 1000),
                });

                // write to DB
                response.body = await ddb
                    .putItem({
                        TableName: process.env.DDB_TABLE,
                        Item: AWS.DynamoDB.Converter.marshall(data),
                    })
                    .promise()
                    .then(() => {
                        return data;
                    })
                    .catch((err) => {
                        console.log(err);
                        return false;
                    });
            }
            break;
    }

    // output the results
    response.body = JSON.stringify(response.body);
    return response;
};
