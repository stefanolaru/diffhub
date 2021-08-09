const AWS = require("aws-sdk"),
    { v4: uuid } = require("uuid");

AWS.config.update({
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
});

const ddb = new AWS.DynamoDB();

/**
 * 	Project Get
 * 	retrieve the project data from DB
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
 *  Project Create - requires  data.name
 * 	returns project object
 */
module.exports.create = async (data) => {
    return new Promise((resolve, reject) => {
        // assign default values
        Object.assign(data, {
            entity: "project",
            id: uuid(),
            // name: 'Project name',
            created_at: Math.floor(+new Date() / 1000),
            // variables: {},
            // notifications: {},
            tests_count: 0,
        });

        console.log(data);

        // write to DB
        ddb.putItem({
            TableName: process.env.DDB_TABLE,
            Item: AWS.DynamoDB.Converter.marshall(data),
        })
            .promise()
            .then(() => resolve(data))
            .catch((err) => {
                console.log(err);
                reject(err.message);
            });
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
                entity: "project",
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
 * Project delete
 * requires project ID
 * returns true or error
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
