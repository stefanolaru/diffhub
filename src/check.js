const axios = require("axios"),
    yaml = require("js-yaml"),
    fs = require("fs"),
    AWS = require("aws-sdk");

AWS.config.update({
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
});

const ddb = new AWS.DynamoDB();

// function handler
exports.handler = async (event) => {
    //
    let websites;
    // load the websites from config
    try {
        websites = yaml.load(fs.readFileSync("./websites.yml", "utf8"));
    } catch (e) {
        console.log(e);
        return false;
    }

    // extract the config keys
    const keys = Object.keys(websites);

    // no websites, nothing to check
    if (!keys.length) return false;

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
    for (var key in websites) {
        // get website
        const website = websites[key];
        const url =
            typeof website === "string"
                ? website
                : website.url
                ? website.url
                : null;

        // add to the promises
        if (url) {
            promises.push(
                axios({
                    method: website.method || "GET",
                    url: url,
                    headers: website.headers || {},
                    timeout: website.timeout || 5000, // set 5 seconds timeout
                    maxRedirects: website.maxRedirects || 0, // don't follow the redirects
                })
            );
        }
    }

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
    const output = {},
        ddb_requests = [];

    // loop the results
    result.forEach((res, idx) => {
        // promise resolved if status === fulfilled, otherwise we find the reason
        res = res.status === "fulfilled" ? res.value : res.reason;

        const item = {
            status: res.code || res.status || res.response.status, // reject will return failure, success will return status, axios error will return response.status
            message: res.message || res.statusText, // reject will return message, success will return statusText
            start_time: Math.round(res.config.__start_time / 1000),
            duration: res.config.__request_duration || null, // for rejects there's no calculated duration
        };

        // update the output
        output[keys[idx]] = item;

        // add to logs to ddb write
        ddb_requests.push({
            PutRequest: {
                Item: AWS.DynamoDB.Converter.marshall(
                    // add the id, created_at & expiration attributes
                    Object.assign(item, {
                        id: keys[idx],
                        created_at: Math.round(+new Date() / 1000),
                        // after 7 days
                        expires_at:
                            Math.round(+new Date() / 1000) + 3600 * 24 * 7,
                    })
                ),
            },
        });
    });

    // write results to Dynamo in batches
    if (ddb_requests.length) {
        const ddb_chunks = chunkArray(ddb_requests, 25),
            ddb_promises = [];

        ddb_chunks.forEach((chunk) => {
            const params = { RequestItems: {} };
            params.RequestItems[process.env.DDB_LOGS_TABLE] = chunk;
            ddb_promises.push(ddb.batchWriteItem(params).promise());
        });

        // wait for dynamodb to write results
        await Promise.all(ddb_promises)
            .then()
            .catch((err) => {
                console.log(err);
            });
    }

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
