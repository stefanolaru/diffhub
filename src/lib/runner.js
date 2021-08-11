const browserRunner = require("./core/browser"),
    basicRunner = require("./core/basic");
/**
 * requires test data & log
 * returns the log updated with the test results
 */

module.exports.run = async (data, log, type) => {
    // instantiate the test runner
    const runner = type === "browser" ? new browserRunner() : new basicRunner();

    // add start time to the log
    Object.assign(log, {
        started_at: Date.now(),
        steps: [], // and empty steps
    });

    try {
        // open the browser, if it's a browser test
        if (type === "browser") {
            await runner
                .browserOpen()
                .then()
                .catch((err) => err);
        }

        // failed flag
        let failed = false;

        // loop test steps
        while (data.steps.length) {
            const step = data.steps.shift();
            // console.log(step);
            if (typeof runner[step.action] !== "undefined") {
                failed = await runner[step.action](step)
                    .then((r) => false)
                    .catch((err) => {
                        // log the err for the CloudWatch logs
                        console.log(err);
                        //
                        return true;
                    });
            } else {
                // set failed flag
                failed = true;
            }

            // add the step to the log steps
            log.steps.push(
                Object.assign(step, {
                    status: failed === true ? "FAIL" : "PASS",
                })
            );

            // stop at first test failure, break the loop
            if (failed) {
                break;
            }
        }

        // close the browser, if instance exists
        if (type === "browser" && runner.browser !== null) {
            await runner.browserClose();
        }
        //
    } catch (e) {
        // something failed
        console.log(e);
    }

    // add duration & final status to the output
    Object.assign(log, {
        // if no steps logged or any step failed, it's a fail
        status:
            !log.steps ||
            !log.steps.length ||
            log.steps.findIndex((x) => x.status === "FAIL") > -1
                ? "FAIL"
                : "PASS",
        duration: Math.round(Date.now() - log.started_at),
        // set ts in seconds
        started_at: Math.round(log.started_at / 1000),
    });

    // return promise resolve/reject
    return log.status === "PASS" ? Promise.resolve(log) : Promise.reject(log);
};
