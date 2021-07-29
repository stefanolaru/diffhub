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
    const sender = config.notifications.from;

    // no websites, nothing to check
    if (!sender) return false;

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
    if (verified_emails.indexOf(sender.email) === -1) {
        await ses
            .verifyEmailIdentity({
                EmailAddress: sender.email,
            })
            .promise()
            .then((res) => {
                console.log("Sent verification email: " + sender.email);
            })
            .catch((err) => {
                console.log(err);
            });
    } else {
        console.log("Email already verified: " + sender.email);
    }

    // return
    return sender;
};
