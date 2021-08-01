const AWS = require("aws-sdk"),
    { v4: uuid } = require("uuid");

AWS.config.update({
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
});

const ddb = new AWS.DynamoDB(),
    eb = new AWS.EventBridge();

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
 * 	Project Update
 * 	retuns true or error
 */
module.exports.update = async (id, data) => {
    return new Promise((resolve, reject) => {
        // init empty stuff here
        let ean = {}; // expression attribute names
        let eav = {}; // expression attribute values
        let uexpr = []; // update expr arr

        // remove id from data if present
        let pdata = Object.assign({}, data);

        // fields that can be updated
        const key_whitelist = [
            "invocations_count",
            "name",
            "tests_count",
            "variables",
            "notifications",
        ];

        //
        // loop all data keys, remove the keys that are not present in whitelist
        Object.keys(pdata).forEach((key) => {
            if (key_whitelist.indexOf(key) == -1) {
                delete pdata[key];
            }
        });

        // add updated flag
        pdata["updated_at"] = Math.round(+new Date() / 1000);

        // loop obj keys
        Object.keys(pdata).forEach((key) => {
            ean["#" + key] = key.toString();
            eav[":" + key] = pdata[key];
            uexpr.push("#" + key + "=:" + key);
        });

        // update db
        ddb.updateItem({
            TableName: process.env.DDB_TABLE,
            Key: AWS.DynamoDB.Converter.marshall({
                entity: "project",
                id: id,
            }),
            ExpressionAttributeNames: ean,
            ExpressionAttributeValues: AWS.DynamoDB.Converter.marshall(eav),
            UpdateExpression: "SET " + uexpr.join(", "),
        })
            .promise()
            .then(() => resolve(true))
            .catch((err) => reject(err.message));
    });
};

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
