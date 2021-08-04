// temp function
const runner = require("./lib/runner-browser");
exports.handler = async (event) => {
    console.log("Browser test run.");
    await runner
        .run({}, {})
        .then((res) => res)
        .catch((err) => err);

    return true;
};
