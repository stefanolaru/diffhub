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
                        FunctionName:
                            data.type === "basic"
                                ? process.env.LAMBDA_BASIC
                                : process.env.LAMBDA_BROWSER,
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
                                Arn:
                                    data.type === "basic"
                                        ? process.env.LAMBDA_BASIC
                                        : process.env.LAMBDA_BROWSER,
                                // RoleArn: process.env.IAM_ROLE,
                                Input: JSON.stringify({
                                    test: "me",
                                }),
                            },
                        ],
                    })
                    .promise();
            })
            .then(() => {
                resolve();
            })
            .catch((err) => {
                reject(err);
            });
    });

const removeEventRule = async (id) => new Promise((resolve, reject) => {});
