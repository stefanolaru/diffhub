// temp function
const runner = require("./lib/runner-browser");
exports.handler = async (event) => {
    console.log("Browser test run.");

    const mockdata = require("../mockdata/test-browser.json");

    await runner
        .run(mockdata, {})
        .then((res) => {
            console.log(res);
        })
        .catch((err) => err);

    return true;
};
