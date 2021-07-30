const axios = require("axios"),
    AWS = require("aws-sdk");

AWS.config.update({
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
});

const ddb = new AWS.DynamoDB(),
    // sns = new AWS.SNS(),
    ses = new AWS.SES();

// function handler
exports.handler = async (event) => {
    // prepare the response object
    const response = {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*", // Required for CORS support to work
            "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        body: "",
    };

    // start timestamp & load configuration
    const start_time = Date.now(),
        config = await ddb
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

    // load the websites from config
    if (!config) {
        // return configuration error, hard error
        response.statusCode = 400;
        response.body = JSON.stringify({
            message: "Configuration could not be loaded.",
        });
        return response;
    }

    // extract the config keys
    const tests = config.tests;

    // no websites, nothing to check
    if (!tests.length) {
        // soft error
        response.body = JSON.stringify({ message: "No tests to load." });
        return response;
    }

    // create the axios interceptors
    // add start time before request is made
    axios.interceptors.request.use((config) => {
        config["__start_time"] = Date.now();
        // console.log(config);
        return config;
    });
    // add end time & duration on response
    axios.interceptors.response.use((response) => {
        response.config["__end_time"] = Date.now();
        response.config["__request_duration"] =
            Date.now() - response.config.__start_time;
        return response;
    });

    // create the requests
    const promises = [];
    tests.forEach((item) => {
        // add to the promises
        if (
            item.url &&
            (item.url.startsWith("http://") || item.url.startsWith("https://"))
        ) {
            promises.push(
                axios({
                    method: item.method || "GET",
                    url: item.url,
                    headers: item.headers || {},
                    timeout: item.timeout || 5000, // set 5 seconds timeout
                    maxRedirects: item.maxRedirects || 0, // don't follow the redirects
                })
            );
        }
    });

    // if nothing to promise, something went wrong, stop here :P
    if (!promises.length) {
        // soft error
        response.body = JSON.stringify({ message: "No URLs to test." });
        return response;
    }

    // using Promise.allSettled instead of Promise.all so it won't stop at first failure
    const result = await Promise.allSettled(promises)
        .then((res) => res)
        .catch((err) => {
            console.log(err);
            return false;
        });

    // if we got here, were' good
    // prepare the output
    const output = [];
    let pass = true;

    // loop the results
    result.forEach((res) => {
        // promise resolved if status === fulfilled, otherwise we find the reason
        res = res.status === "fulfilled" ? res.value : res.reason;

        const item = {
            id: res.config.url,
            status: res.code || res.status || res.response.status, // reject will return failure, success will return status, axios error will return response.status
            message: res.message || res.statusText, // reject will return message, success will return statusText
            start_time: Math.round(res.config.__start_time / 1000),
            duration: res.config.__request_duration || null, // for rejects there's no calculated duration
        };

        // if any status is not 200, no longer passes
        if (item.status != 200) {
            pass = false;
        }

        // update the output
        output.push(item);
    });

    // write the logs to DynamoDB (in batches)
    await writeLogsToDB(output, start_time, pass)
        .then()
        .catch((err) => {
            console.log(err);
        });

    // get the previous runs
    const prev_runs = await getPreviousRuns()
        .then((res) => res)
        .catch((err) => {
            console.log(err);
            return [];
        });

    const prev = prev_runs.shift();
    //
    console.log(prev.pass, pass);

    // send sample email
    if ((prev && prev.pass !== pass) || (!prev && !pass)) {
        await sendEmailNotification(config, output)
            .then()
            .catch((err) => {
                console.log(err);
            });
    }

    // return the output
    response.body = JSON.stringify(output);
    return response;
};

const chunkArray = (arr, size) => {
    var chunks = [],
        i = 0,
        n = arr.length;

    while (i < n) {
        chunks.push(arr.slice(i, (i += size)));
    }
    return chunks;
};

const writeLogsToDB = async (output, start_time, pass) =>
    new Promise((resolve, reject) => {
        //
        const ddb_requests = [],
            ddb_promises = [];

        // loop output and build ddb_requests
        output.forEach((item) => {
            // add to logs to ddb write
            ddb_requests.push({
                PutRequest: {
                    Item: AWS.DynamoDB.Converter.marshall(
                        // add the created_at & expiration attributes
                        Object.assign(item, {
                            created_at: Math.round(+new Date() / 1000),
                            // after 7 days
                            expires_at:
                                Math.round(+new Date() / 1000) + 3600 * 24 * 7,
                        })
                    ),
                },
            });
        });

        // add complete output to the DB to have future reference
        ddb_requests.push({
            PutRequest: {
                Item: AWS.DynamoDB.Converter.marshall({
                    id: "__log",
                    output: output,
                    created_at: Math.round(+new Date() / 1000),
                    // after 7 days
                    expires_at: Math.round(+new Date() / 1000) + 3600 * 24 * 7,
                    start_time: Math.round(start_time / 1000),
                    duration: Math.round(Date.now() - start_time),
                    pass: pass,
                }),
            },
        });

        const ddb_chunks = chunkArray(ddb_requests, 25);

        ddb_chunks.forEach((chunk) => {
            const params = { RequestItems: {} };
            params.RequestItems[process.env.DDB_TABLE] = chunk;
            ddb_promises.push(ddb.batchWriteItem(params).promise());
        });

        // wait for dynamodb to write results
        return Promise.all(ddb_promises)
            .then(() => {
                resolve(output);
            })
            .catch((err) => {
                reject(err);
            });
    });

const getPreviousRuns = async () =>
    new Promise((resolve, reject) => {
        ddb.query({
            TableName: process.env.DDB_TABLE,
            KeyConditionExpression: "#id = :id",
            ExpressionAttributeValues: AWS.DynamoDB.Converter.marshall({
                ":id": "__log",
            }),
            ExpressionAttributeNames: {
                "#id": "id",
            },
            ScanIndexForward: false,
            Limit: 10,
        })
            .promise()
            .then((res) => {
                var items = [];
                if (res.Items.length) {
                    res.Items.forEach((item) =>
                        items.push(AWS.DynamoDB.Converter.unmarshall(item))
                    );
                }
                resolve(items);
            })
            .catch((err) => reject(err.message));
    });

const sendEmailNotification = async (config, output) =>
    new Promise((resolve, reject) => {
        if (!config.notifications.email) {
            return resolve(false);
        }
        return ses
            .sendTemplatedEmail({
                Source:
                    config.notifications.from.name +
                    " <" +
                    config.notifications.from.email +
                    ">",
                Template: process.env.SES_TEMPLATE,
                Destination: {
                    ToAddresses: config.notifications.email,
                },
                TemplateData: JSON.stringify({
                    subject:
                        pass === false
                            ? config.notifications.subject.fail
                            : config.notifications.subject.pass,
                    output: output,
                }),
            })
            .promise()
            .then((res) => {
                resolve(true);
            })
            .catch((err) => {
                // console.log(err);
                // resolve false in case of an error
                resolve(false);
            });
    });
