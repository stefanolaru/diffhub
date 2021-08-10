const AWS = require("aws-sdk"),
    { v4: uuid } = require("uuid"),
    { encrypt, decrypt } = require("../utility/crypto");

AWS.config.update({
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
});

const ddb = new AWS.DynamoDB();

/**
 *  Project Create - requires  data.name
 * 	resolves project object containing id and created_at
 */
module.exports.create = async (data) => {
    return new Promise((resolve, reject) => {
        // generate id
        const project_id = uuid();
        // assign default values
        Object.assign(data, {
            entity: "project",
            id: project_id,
            created_at: Math.floor(+new Date() / 1000),
            created_by: data.created_by || "api",
            variables: encrypt(
                JSON.stringify(data.variables || {}),
                project_id.replace(/-/g, "") // remove hyphens from ID
            ),
            notifications: data.notifications || {},
            tests_count: 0,
        });

        // write to DB
        ddb.putItem({
            TableName: process.env.DDB_TABLE,
            Item: AWS.DynamoDB.Converter.marshall(data),
        })
            .promise()
            .then(() =>
                resolve({
                    id: project_id,
                    created_at: data.created_at,
                })
            )
            .catch((err) => {
                console.log(err);
                reject(err.message);
            });
    });
};

/**
 * 	Project Get
 * 	resolves the project object
 */

module.exports.get = async (id) => {
    return new Promise((resolve, reject) => {
        ddb.getItem({
            TableName: process.env.DDB_TABLE,
            Key: AWS.DynamoDB.Converter.marshall({
                entity: "project",
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
                reject("Project not accessible.");
            })
            .catch((err) => reject(err.message));
    });
};

/**
 *  Projects List
 *  optional limit parameter to get more logs
 * 	returns array of objects
 */

module.exports.list = async (limit = -1) =>
    new Promise((resolve, reject) => {
        const params = {
            TableName: process.env.DDB_TABLE,
        };

        // query index
        Object.assign(params, {
            KeyConditionExpression: "#entity = :entity",
            ExpressionAttributeNames: {
                "#entity": "entity",
            },
            ExpressionAttributeValues: AWS.DynamoDB.Converter.marshall({
                ":entity": "project",
            }),
            ScanIndexForward: false,
        });

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
 * 	Project Update - requires project_id & data
 * 	retuns true or error
 */
module.exports.update = async (project_id, data, silent = false) =>
    new Promise((resolve, reject) => {
        // remove protected keys from data
        ["entity", "id", "created_by", "created_at"].forEach((key) => {
            delete data[key];
        });

        // init empty stuff here
        const ean = {}, // expression attribute names
            eav = {}, // expression attribute values
            uexpr = []; // update expr arr

        // add updated_at flag
        if (!silent) {
            Object.assign(data, {
                updated_at: Math.floor(+new Date() / 1000),
                updated_by: data.updated_by || "api",
            });
        }

        // if data contains variables, encrypt
        if (typeof data.variables === "object") {
            Object.assign(data, {
                variables: encrypt(
                    JSON.stringify(data.variables),
                    project_id.replace(/-/g, "") // remove hyphens
                ),
            });
        }

        // loop obj keys an prepare Expression attr names & values + update expression
        Object.keys(data).forEach((key) => {
            ean["#" + key] = key.toString();
            eav[":" + key] = data[key];
            uexpr.push("#" + key + "=:" + key);
        });

        // update db
        ddb.updateItem({
            TableName: process.env.DDB_TABLE,
            Key: AWS.DynamoDB.Converter.marshall({
                entity: "project",
                id: project_id,
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
 * Project delete
 * requires project ID
 * resolves true or error
 */

module.exports.delete = async (id) => {
    return new Promise((resolve, reject) => {
        ddb.deleteItem({
            TableName: process.env.DDB_TABLE,
            Key: AWS.DynamoDB.Converter.marshall({ entity: "project", id: id }),
        })
            .promise()
            .then(() => {
                // cleanup the mess
                // 1) delete all tests within project
                // 2) delete all logs within project ? maybe not, they have TTL
                // 3) delete all eventbus rules
            })
            .then(() => resolve(true))
            .catch((err) => reject(err.message));
    });
};

/**
 * Project decrypt variables
 * requires project ID & variables hash
 * resolves decoded object
 */
module.exports.decryptVariables = (project_id, hash) =>
    decrypt(hash, project_id.replace(/-/g, ""));
