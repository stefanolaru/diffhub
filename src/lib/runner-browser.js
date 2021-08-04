const chromium = require("chrome-aws-lambda"),
    expect = require("expect");

/**
 * Browser test run, does opens a browser
 * requires test data & log
 * returns the log updated with the test results
 */
const mock_steps = [
    {
        action: "navigate",
        config: {
            url: "https://crafty.ro",
        },
    },
    {
        action: "type",
        context: "document",
        config: {
            selector: ".search_field",
            text: "stefan",
            options: {
                delay: 5,
            },
        },
    },
    // {
    //     action: "expect",
    //     context: "response",
    //     matcher: ["headers.content-type", "toContain", "text/html"],
    // },
    // {
    //     action: "expect",
    //     context: "response",
    //     matcher: ["data", "toContain", "theLoginModal"],
    // },
    // {
    //     action: "expect",
    //     context: "response",
    //     matcher: ["duration", "toBeLessThan", 2000],
    // },
];

module.exports.run = async (data, log) => {
    // instantiate the test runner
    const runner = new browserRunner();

    data = {
        steps: mock_steps,
    };
    log["steps"] = [];

    // open the browser
    await runner
        .browserOpen()
        .then()
        .catch((err) => err);

    //
    if (runner.browser !== null) {
        // loop test steps
        while (data.steps.length) {
            const step = data.steps.shift();
            // console.log(step);
            try {
                await runner[step.action](step)
                    .then(() => {
                        // add passed step to the output
                        log.steps.push(
                            Object.assign(step, {
                                status: "PASS",
                            })
                        );
                    })
                    .catch((err) => {
                        // add failed step to the output
                        log.steps.push(
                            Object.assign(step, {
                                status: "FAIL",
                            })
                        );
                        // log the err for the CloudWatch logs
                        console.log(err);
                        // update the output with the overall status
                        Object.assign(log, {
                            status: "FAIL",
                        });
                    });
            } catch (e) {
                // log the err for the CloudWatch logs
                console.log(e);
                // update the output with the overall status
                Object.assign(log, {
                    status: "FAIL",
                });
            }
            // stop at first test failure, break the loop
            if (log.status === "FAIL") {
                break;
            }
        }
    }

    console.log(runner.resources);

    // close the browser, if instance exists
    if (runner.browser !== null) await runner.browserClose();

    return Promise.resolve(true);
};

class browserRunner {
    // constructor
    constructor() {
        // browser & page
        this.browser = null;
        this.page = null;
        // browser console
        this.console = {
            logs: [],
            warnings: [],
            errors: [],
        };
        // page metrics & resources
        this.metrics = {
            start_time: null,
            duration: null,
            pagesize: 0,
        };
        this.resources = [];
    }
    async browserOpen() {
        try {
            // start browser
            this.browser = await chromium.puppeteer.launch({
                executablePath: await chromium.executablePath,
                headless: false,
            });

            // open new page
            this.page = await this.browser.newPage();

            // set start time
            let { Timestamp } = await this.page.metrics();
            this.metrics.start_time = Timestamp;

            this.pageInterceptors();

            // disable cache
            await this.page.setCacheEnabled(false);
        } catch (e) {
            console.log(e);
            return Promise.reject("Browser failed.");
        }
        // return true
        return Promise.resolve(true);
    }
    async browserClose() {
        await this.browser.close();
    }
    //
    pageInterceptors() {
        // intercept page requests
        this.page.on("response", async (res) => {
            // calculate page size
            this.metrics.pagesize += await res
                .buffer()
                .then((bffr) => {
                    // append resource
                    this.resources.push({
                        url: res.url(),
                        type: res.request().resourceType(),
                        size: bffr.length,
                    });

                    // return buffer length to increment total page size
                    return bffr.length;
                })
                .catch(() => 0);
        });
        // intercept console logs
        this.page.on("console", (msg) => {
            let key =
                msg.type() == "error"
                    ? "errors"
                    : msg.type() == "warning"
                    ? "warnings"
                    : "logs";
            this.console[key].push({
                text: msg.text(),
                location: msg.location(),
            });
        });
        // intercept page errors
        this.page.on("pageerror", (err) => {
            this.console.errors.push({
                text: err.message,
                location: null,
            });
        });
        // intercept page dialogs, could be an error?
        this.page.on("dialog", async (dialog) => {
            console.log(await dialog.message());
            // await dialog.dismiss();
        });
    }
    // puppeteer methods
    async authenticate(step) {
        return await this.page.authenticate(step.config);
    }
    // set extra http header
    async header(step) {
        // set headers
        return await this.page.setExtraHTTPHeaders(step.config);
    }
    // set geolocation
    async geolocation(step) {
        // set geolocation
        return await this.page.setGeolocation(step.config);
    }
    // set user agent
    async useragent(step) {
        // set geolocation
        return await this.page.setUserAgent(step.config);
    }
    // set viewport size
    async viewport(step) {
        return await this.page.setViewport(step.config);
    }
    // navigate
    async navigate(step) {
        const config = step.config || {};
        // add default navigation config
        Object.assign(config, {
            waitUntil: step.config.waitUntil || [
                "domcontentloaded",
                "networkidle2",
            ],
            timeout: step.config.timeout || 5000,
        });
        //
        await this.page
            .goto(config.url, config)
            .then()
            .catch((err) => console.log(err));
    }
    // type text into input
    async type(step) {
        return await this.page.type(
            step.config.selector,
            step.config.text,
            step.config.options || {}
        );
    }
    // page reload
    async reload(step) {
        const config = step.config || {};
        // add default navigation config
        Object.assign(config, {
            waitUntil: step.config.waitUntil || [
                "domcontentloaded",
                "networkidle2",
            ],
            timeout: step.config.timeout || 5000,
        });
        return await this.page.reload(step);
    }

    async wait(step) {
        // if target is null, wait for interval, else wait for target
        switch (step.value.type) {
            case "selector":
                return await this.page.waitFor(step.value.selector, {
                    timeout: this.timeout,
                });
            case "navigation":
                return await this.page.waitForNavigation({
                    waitUntil: ["domcontentloaded", "networkidle2"],
                    timeout: this.timeout,
                });
            default:
                return await this.page.waitFor(parseInt(step.value.timeout), {
                    timeout: this.timeout,
                });
        }
    }
}
