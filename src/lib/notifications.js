const AWS = require("aws-sdk"),
    axios = require("axios"),
    Log = require("./entities/log");

AWS.config.update({
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
});

const ses = new AWS.SES();

const mock = {
    email: {
        subject: {
            PASS: "✅ Project: Test name",
            FAIL: "🚨 Project: Test name",
        },
        from: {
            name: "Project name",
            email: "contact@stefanolaru.com",
        },
        recipients: [
            {
                email: "olaroost@gmail.com",
                status: "CHANGE", // ANY, PASS, FAIL, CHANGE // default: CHANGE
            },
        ],
    },
    webhook: [
        {
            config: {
                url: "https://sample.webhook",
            },
            status: "FAIL",
        },
    ],
};
/**
 *  Send notifications - requires log, test data & project data
 * 	returns ?
 */
module.exports.send = async (log, data, project) => {
    // temp override data.notifications
    data.notifications = mock;

    // if no notifications are set, stop early,
    if (!data.notifications && !project.notifications)
        return Promise.reject("No notifications to be sent.");

    // get notifications, test notifications override the project ones
    const notifications = data.notifications || project.notifications;

    // do we need to look for a status change?
    let check_status_change = false,
        status_changed = false;

    // check email notifications
    if (notifications.email && notifications.email.recipients) {
        check_status_change =
            notifications.email.recipients.findIndex(
                (x) => x.status === "CHANGE"
            ) > -1;
    }

    // if still false, look into webhooks, if any
    if (!check_status_change && notifications.webhook) {
        check_status_change =
            notifications.webhook.findIndex((x) => x.status === "CHANGE") > -1;
    }

    // if we're looking for a status change, pull previous runs
    if (check_status_change) {
        // get the previous logs for this test and compare status
        await Log.list(data.id)
            .then((res) => {
                // check if has no previous run or the status is different
                status_changed =
                    res.length < 2 || res[0].status !== res[1].status;
            })
            .catch((err) => {
                console.log(err);
            });
    }

    // build the email recipients list
    const recipients = [];
    if (notifications.email && notifications.email.recipients) {
        notifications.email.recipients.forEach((recipient) => {
            if (
                (recipient.status === "CHANGE" && status_changed === true) ||
                recipient.status === "ANY" ||
                recipient.status === log.status
            ) {
                recipients.push(recipient.email);
            }
        });

        // if any recipients, send email
        if (recipients.length) {
            await ses
                .sendTemplatedEmail({
                    Source:
                        notifications.email.from.name +
                        " <" +
                        notifications.email.from.email +
                        ">",
                    Template: process.env.SES_TEMPLATE,
                    Destination: {
                        ToAddresses: recipients,
                    },
                    TemplateData: JSON.stringify({
                        subject: notifications.email.subject[log.status],
                        log: log,
                        test: data,
                        project: project,
                    }),
                })
                .promise()
                .then()
                .catch((err) => {
                    console.log(err);
                });
        }
    }

    // build the webhooks list
    const webhooks = [],
        promises = [];
    if (notifications.webhook && notifications.webhook.length) {
        notifications.webhook.forEach((webhook) => {
            if (
                (webhook.status === "CHANGE" && status_changed === true) ||
                webhook.status === "ANY" ||
                webhook.status === log.status
            ) {
                webhooks.push(webhook);
                //
                promises.push(
                    axios({
                        method: "POST",
                        url: webhook.config.url,
                        headers: webhook.config.headers || {},
                        timeout: webhook.config.timeout || 5000, // set 5 seconds timeout
                        data: JSON.stringify({
                            test: data,
                            log: log,
                        }), // send the test & log as payload
                    })
                );
            }
        });

        // using Promise.allSettled instead of Promise.all so it won't stop at first failure
        if (promises.length) {
            await Promise.allSettled(promises)
                .then()
                .catch((err) => {
                    console.log(err);
                });
        }
    }

    return Promise.resolve({
        recipients: recipients,
        webhooks: webhooks,
    });
};

/**
 *  Validate email as SES sender
 *  requires email address
 * 	returns email address
 */
module.exports.validateSenderEmail = async (email) => {
    // get verified emails from this account
    const verified_emails = await ses
        .listIdentities({
            IdentityType: "EmailAddress",
        })
        .promise()
        .then((res) => res.Identities)
        .catch((err) => {
            console.log(err);
            return [];
        });

    // validate sender email
    if (verified_emails.indexOf(email) === -1) {
        await ses
            .verifyEmailIdentity({
                EmailAddress: email,
            })
            .promise()
            .then((res) => {
                console.log("Sent verification email: " + email);
            })
            .catch((err) => {
                console.log(err);
            });
    } else {
        console.log("Email already verified: " + email);
    }

    // return
    return email;
};
