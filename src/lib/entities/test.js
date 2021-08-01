const AWS = require("aws-sdk"),
    { v4: uuid } = require("uuid");

AWS.config.update({
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
});

const ddb = new AWS.DynamoDB(),
    eb = new AWS.EventBridge();

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
            project_id: data.project_id || null,
            created_at: Math.floor(+new Date() / 1000),
            trigger: data.trigger || "manual",
            runs_count: 0,
        });

        if (!data.project_id) {
            reject("project_id is required");
        }

        console.log(data);

        // write to DB
        ddb.putItem({
            TableName: process.env.DDB_TABLE,
            Item: AWS.DynamoDB.Converter.marshall(data),
        })
            .promise()
            .then(() => {
                // create the event rule for scheduled tests
                if (data.trigger === "scheduled" && data.schedule) {
                    return eb
                        .putRule({
                            Name: "uptimemonitor_" + data.id,
                            EventBusName: "uptimemonitor_" + project_id,
                            ScheduleExpression: data.schedule,
                            State: "ENABLED",
                        })
                        .promise();
                } else {
                    // just return an empty promise
                    return Promise.resolve(false);
                }
            })
            .then((res) => {
                console.log(res);
                resolve(data);
            })
            .catch((err) => {
                console.log(err);
                reject(err.message);
            });
    });
};
