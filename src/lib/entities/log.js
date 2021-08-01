const AWS = require("aws-sdk"),
    { v4: uuid } = require("uuid");

AWS.config.update({
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
});

const ddb = new AWS.DynamoDB();

/**
 *  Log Create - requires test_id & trigger type
 * 	returns log object
 */
module.exports.create = async (test_id, trigger) =>
    new Promise((resolve, reject) => {
        // assign default values
        const data = {
            entity: "log",
            id: uuid(),
            test_id: test_id,
            created_at: Math.floor(+new Date() / 1000),
            // after 7 days (TTL)
            expires_at: Math.round(+new Date() / 1000) + 3600 * 24 * 7,
            status: "RUNNING",
            trigger: trigger,
        };

        // write to DB
        ddb.putItem({
            TableName: process.env.DDB_TABLE,
            Item: AWS.DynamoDB.Converter.marshall(data),
        })
            .promise()
            .then(() => resolve(data))
            .catch((err) => reject(err.message));
    });

/**
 * 	Log Update
 * 	retuns true or error
 */
module.exports.update = async (data) =>
    new Promise((resolve, reject) => {
        // init empty stuff here
        let ean = {}; // expression attribute names
        let eav = {}; // expression attribute values
        let uexpr = []; // update expr arr

        // loop obj keys
        Object.keys(data).forEach((key) => {
            ean["#" + key] = key.toString();
            eav[":" + key] = data[key];
            uexpr.push("#" + key + "=:" + key);
        });

        // update db
        ddb.updateItem({
            TableName: process.env.DDB_TABLE,
            Key: AWS.DynamoDB.Converter.marshall({
                entity: "log",
                id: log.id,
            }),
            ExpressionAttributeNames: ean,
            ExpressionAttributeValues: AWS.DynamoDB.Converter.marshall(eav),
            UpdateExpression: "SET " + uexpr.join(", "),
        })
            .promise()
            .then(() => resolve(true))
            .catch((err) => reject(err.message));
    });
