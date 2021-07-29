const axios = require("axios"),
    yaml = require("js-yaml"),
    fs = require("fs"),
    AWS = require("aws-sdk");

AWS.config.update({
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
});

const ddb = new AWS.DynamoDB(),
    sns = new AWS.SNS(),
    ses = new AWS.SES();

// function handler
exports.handler = async (event) => {
    //
    let config,
        start_time = Date.now(),
        passed = true;
    // load the websites from config
    try {
        config = yaml.load(fs.readFileSync("./config.yml", "utf8"));
    } catch (e) {
        console.log(e);
        return false;
    }

    // extract the config keys
    const pages = config.pages;

    // no websites, nothing to check
    if (!pages.length) return false;

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
    pages.forEach((page) => {
        const url =
            typeof page === "string" ? page : page.url ? page.url : null;

        // add to the promises
        if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
            promises.push(
                axios({
                    method: page.method || "GET",
                    url: url,
                    headers: page.headers || {},
                    timeout: page.timeout || 5000, // set 5 seconds timeout
                    maxRedirects: page.maxRedirects || 0, // don't follow the redirects
                })
            );
        }
    });

    // if nothing to promise, something went wrong, stop here :P
    if (!promises.length) return false;

    // using Promise.allSettled instead of Promise.all so it won't stop at first failure
    const result = await Promise.allSettled(promises)
        .then((res) => res)
        .catch((err) => {
            console.log(err);
            return false;
        });

    // prepare the output
    const output = [];

    // loop the results
    result.forEach((res, idx) => {
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
            passed = false;
        }

        // update the output
        output.push(item);
    });

    // write the logs to DynamoDB (in batches)
    await writeLogsToDB(output, start_time, passed)
        .then()
        .catch((err) => {
            console.log(err);
        });

    await getPreviousRuns()
        .then((res) => {
            console.log(res);
        })
        .catch((err) => {
            console.log(err);
        });

    // extract the config keys
    const recipients = config.notifications.email || [];
    console.log(recipients);

    // test render template
    var params = {
        TemplateData: "STRING_VALUE" /* required */,
        TemplateName: "STRING_VALUE" /* required */,
    };
    await ses.testRenderTemplate(
        {
            TemplateName: process.env.SES_TEMPLATE,
            TemplateData: JSON.stringify({
                subject: "🚨 Test failed",
                output: output,
            }),
        },
        function (err, data) {
            if (err) console.log(err, err.stack);
            // an error occurred
            else console.log(data); // successful response
        }
    );

    // send sample email
    await ses
        .sendTemplatedEmail({
            Source:
                config.notifications.from.name +
                " <" +
                config.notifications.from.email +
                ">",
            Template: process.env.SES_TEMPLATE,
            Destination: {
                ToAddresses: recipients,
            },
            TemplateData: JSON.stringify({
                subject: "🚨 Test failed",
                output: output,
            }),
        })
        .promise()
        .then((res) => {
            console.log(res);
        })
        .catch((err) => {
            console.log(err);
        });

    // on FAIL send results to the SNS topic
    if (passed === false) {
        await sns
            .publish({
                TopicArn: process.env.SNS_TOPIC,
                Message: JSON.stringify(output),
                Subject: "[uptimemonitor] Check Results",
            })
            .promise()
            .then()
            .catch((err) => {
                console.log(err);
            });
    }

    // save output to console
    console.log(output);

    return output;
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

const writeLogsToDB = async (output, start_time, passed) =>
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
                    status: passed === true ? "PASS" : "FAIL",
                }),
            },
        });

        const ddb_chunks = chunkArray(ddb_requests, 25);

        ddb_chunks.forEach((chunk) => {
            const params = { RequestItems: {} };
            params.RequestItems[process.env.DDB_LOGS_TABLE] = chunk;
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
            TableName: process.env.DDB_LOGS_TABLE,
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
