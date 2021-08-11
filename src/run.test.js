const Test = require("./lib/entities/test"),
    basicRunner = require("./lib/runner-basic"),
    browserRunner = require("./lib/runner-browser"),
    // mockdata
    basic_test_data = require("../sample-tests/uptime.json"),
    browser_test_data = require("../sample-tests/seo.json"),
    project_vars = {
        base_url: "https://www.google.com",
    };

describe("Run Basic Test", () => {
    //
    var basic_data = Test.replaceVars(basic_test_data, project_vars);

    it("Should run a basic test and return a log object", async () => {
        // console.log(test_data);
        const output = await basicRunner
            .run(basic_data, {})
            .then()
            .catch((err) => err);

        expect(output.status).toBeDefined();
    }, 30000);
});

describe("Run Browser Test", () => {
    //
    var browser_data = Test.replaceVars(browser_test_data, project_vars);

    it("Should run a browser test and return a log object", async () => {
        // console.log(test_data);
        const output = await browserRunner
            .run(browser_data, {})
            .then()
            .catch((err) => err);

        // console.log(output);

        expect(output.status).toBeDefined();
    }, 60000);
});
