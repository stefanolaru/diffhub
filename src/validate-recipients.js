const yaml = require("js-yaml"),
    fs = require("fs"),
    AWS = require("aws-sdk");

AWS.config.update({
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
});

const ses = new AWS.SES();

// function handler
exports.handler = async (event) => {
    //
    let config;
    // load the websites from config
    try {
        config = yaml.load(fs.readFileSync("./config.yml", "utf8"));
    } catch (e) {
        console.log(e);
        return false;
    }

    // extract the config keys
    const recipients = config.notifications.email || [];

    // no websites, nothing to check
    if (!recipients.length) return false;

    const output = {
        validated: [],
        submitted: [],
    };

    // get verified emails from this account
    const verified_emails = await ses
        .listIdentities({
            IdentityType: "EmailAddress",
            MaxItems: 1000,
        })
        .promise()
        .then((res) => res.Identities)
        .catch((err) => {
            console.log(err);
            return [];
        });

    // validate unverified recipients
    const promises = [];
    recipients.forEach((recipient) => {
        //
        if (verified_emails.indexOf(recipient) === -1) {
            output.submitted.push(recipient);
            // push to promises
            promises.push(
                ses
                    .verifyEmailIdentity({
                        EmailAddress: recipient,
                    })
                    .promise()
            );
        } else {
            output.validated.push(recipient);
        }
    });

    // send promises
    await Promise.allSettled(promises)
        .then()
        .catch((err) => console.log(err));

    // return
    return output;
};
