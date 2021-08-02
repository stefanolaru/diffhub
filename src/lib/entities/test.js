const AWS = require("aws-sdk"),
    { v4: uuid } = require("uuid");

AWS.config.update({
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
});

const ddb = new AWS.DynamoDB(),
    eb = new AWS.EventBridge(),
    lambda = new AWS.Lambda();

/**
 *  Test Create - requires project_id
 * 	returns project object
 */
module.exports.create = async (data) => {
    return new Promise((resolve, reject) => {
        // assign default values
        Object.assign(data, {
            entity: "test",
            id: uuid(),
            name: data.name || "Unnamed test",
            type: data.type || "basic",
            project_id: data.project_id,
            test_pk: "test-" + data.project_id,
            created_at: Math.floor(+new Date() / 1000),
            trigger: data.trigger || "manual",
            runs_count: 0,
        });

        if (!data.project_id) {
            reject("project_id is required");
        }

        // console.log(data);

        // write to DB
        ddb.putItem({
            TableName: process.env.DDB_TABLE,
            Item: AWS.DynamoDB.Converter.marshall(data),
        })
            .promise()
            .then(() => {
                // create the event rule for scheduled tests
                if (data.trigger === "scheduled" && data.schedule) {
                    return createEventRule(data);
                } else {
                    // just return an empty promise
                    return Promise.resolve(false);
                }
            })
            .then((res) => resolve(data))
            .catch((err) => {
                console.log(err);
                reject(err.message);
            });
    });
};

/**
 * 	Test Get
 * 	retrieve the project data from DB
 */

module.exports.get = async (id) => {
    return new Promise((resolve, reject) => {
        ddb.getItem({
            TableName: process.env.DDB_TABLE,
            Key: AWS.DynamoDB.Converter.marshall({
                entity: "test",
                id: id,
            }),
        })
            .promise()
            .then((res) => {
                if (res.Item) {
                    let item = AWS.DynamoDB.Converter.unmarshall(res.Item);
                    resolve(item);
                }

                // reject if no project was found
                reject("Test not found.");
            })
            .catch((err) => reject(err.message));
    });
};

/**
 *  Test List - requires test_id
 *  optional limit parameter to get more logs
 * 	returns array of objects
 */

module.exports.list = async (project_id = null, limit = -1) =>
    new Promise((resolve, reject) => {
        const params = {
            TableName: process.env.DDB_TABLE,
        };
        // query index
        if (project_id) {
            Object.assign(params, {
                IndexName: "project_test_created",
                KeyConditionExpression: "#test_pk = :test_pk",
                ExpressionAttributeNames: {
                    "#test_pk": "test_pk",
                },
                ExpressionAttributeValues: AWS.DynamoDB.Converter.marshall({
                    ":test_pk": "test-" + project_id,
                }),
                ScanIndexForward: false,
            });
        } else {
            Object.assign(params, {
                KeyConditionExpression: "#entity = :entity",
                ExpressionAttributeNames: {
                    "#entity": "entity",
                },
                ExpressionAttributeValues: AWS.DynamoDB.Converter.marshall({
                    ":entity": "test",
                }),
                ScanIndexForward: false,
            });
        }

        // add limit
        if (limit > -1) {
            Object.assign(params, {
                Limit: limit,
            });
        }

        // run db query
        ddb.query(params)
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
            .catch((err) => {
                reject(err.message);
            });
    });

/**
 * 	Test Update
 * 	retuns true or error
 */
module.exports.update = async (data, silent = false) =>
    new Promise((resolve, reject) => {
        // init empty stuff here
        let ean = {}; // expression attribute names
        let eav = {}; // expression attribute values
        let uexpr = []; // update expr arr

        // loop obj keys
        Object.keys(data).forEach((key) => {
            // exclude the key from attributes
            if (key != "entity" && key != "id") {
                ean["#" + key] = key.toString();
                eav[":" + key] = data[key];
                uexpr.push("#" + key + "=:" + key);
            }
        });

        // add updated
        if (!silent) {
            Object.assign(data, {
                updated_at: Math.floor(+new Date() / 1000),
            });
        }

        // update db
        ddb.updateItem({
            TableName: process.env.DDB_TABLE,
            Key: AWS.DynamoDB.Converter.marshall({
                entity: "test",
                id: data.id,
            }),
            ExpressionAttributeNames: ean,
            ExpressionAttributeValues: AWS.DynamoDB.Converter.marshall(eav),
            UpdateExpression: "SET " + uexpr.join(", "),
        })
            .promise()
            .then(() => resolve(true))
            .catch((err) => reject(err.message));
    });

/**
 * Test delete
 * requires test object
 * returns true or error
 */

module.exports.delete = async (item) => {
    return new Promise((resolve, reject) => {
        ddb.deleteItem({
            TableName: process.env.DDB_TABLE,
            Key: AWS.DynamoDB.Converter.marshall({
                entity: "test",
                id: item.id,
            }),
        })
            .promise()
            .then(() => {
                // delete the event rule / needs to be reviewed
                return removeEventRule(item);
            })
            .then(() => resolve(true))
            .catch((err) => reject(err.message));
    });
};

/**
 * Replace placeholders with project variables
 * requires test data & project variables
 * returns test data
 */
module.exports.replaceVars = (data, vars) => {
    // if no vars, return early
    if (!vars || !Object.keys(vars).length) return data;

    // stringify data
    data = JSON.stringify(data);

    // replace variables from steps
    data = data.replace(new RegExp(/\{{(.*?)}}/gm), (x, y) => {
        // has env variable, replace it
        if (typeof vars[y] !== "undefined") {
            return vars[y];
        }
        // doesn't have a variable, return the exact string as populated
        return x;
    });

    return data;
};

/**
 * Test run
 * requires test data & log
 */

module.exports.run = (data, log) =>
    lambda
        .invoke({
            FunctionName:
                data.type === "browser"
                    ? process.env.LAMBDA_BROWSER
                    : process.env.LAMBDA_BASIC,
            InvocationType: "Event",
            Payload: JSON.stringify({
                data: data,
                log: log,
            }),
        })
        .promise();

/**
 *  Creates EventBridge rule for scheduled runs
 */
const createEventRule = async (data) =>
    new Promise((resolve, reject) => {
        eb.putRule({
            Name: process.env.RESOURCE_PREFIX + "_" + data.id,
            ScheduleExpression: data.schedule,
            State: "ENABLED",
        })
            .promise()
            .then((res) => {
                return lambda
                    .addPermission({
                        Action: "lambda:InvokeFunction",
                        FunctionName: process.env.LAMBDA_TRIGGER,
                        StatementId: "Lambda_" + data.type + "_" + data.id,
                        Principal: "events.amazonaws.com",
                        SourceArn: res.RuleArn,
                    })
                    .promise();
            })
            .then((res) => {
                return eb
                    .putTargets({
                        Rule: process.env.RESOURCE_PREFIX + "_" + data.id,
                        Targets: [
                            {
                                Id: "Lambda_" + data.type,
                                Arn: process.env.LAMBDA_TRIGGER,
                                // pass test_id to the target
                                Input: JSON.stringify({
                                    test_id: data.id,
                                    trigger: "schedule",
                                }),
                            },
                        ],
                    })
                    .promise();
            })
            .then(() => resolve())
            .catch((err) => reject(err));
    });

/**
 *  Removes the EventBridge rule (incl Targets)
 */
const removeEventRule = async (data) =>
    new Promise((resolve, reject) => {
        // get targets first
        eb.listTargetsByRule({
            Rule: process.env.RESOURCE_PREFIX + "_" + data.id,
        })
            .promise()
            .then((res) => {
                if (res.Targets && res.Targets.length) {
                    // delete targets
                    return eb
                        .removeTargets({
                            Ids: res.Targets.map((item) => item.Id),
                            Rule: process.env.RESOURCE_PREFIX + "_" + data.id,
                        })
                        .promise();
                } else {
                    // just resolve
                    return Promise.resolve(true);
                }
            })
            .then(() => {
                return lambda
                    .removePermission({
                        FunctionName: process.env.LAMBDA_TRIGGER,
                        StatementId: "Lambda_" + data.type + "_" + data.id,
                    })
                    .promise();
            })
            // delete the rule
            .then(() =>
                eb
                    .deleteRule({
                        Name: process.env.RESOURCE_PREFIX + "_" + data.id,
                    })
                    .promise()
            )
            .then(() => resolve())
            .catch((err) => {
                // resolve anyway
                console.log(err);
                resolve();
            });
    });
