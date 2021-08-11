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

    // open the browser, if it's a browser test
    if (type === "browser") {
        await runner
            .browserOpen()
            .then()
            .catch((err) => err);
    }

    //
    if (runner.browser !== null) {
        // loop test steps
        while (data.steps.length) {
            const step = data.steps.shift();
            // console.log(step);
            try {
                await runner[step.action](step)
                    .then((r) => {
                        // console.log(r);
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
                    });
            } catch (e) {
                // log the err for the CloudWatch logs
                console.log(e);
                // update the output with the overall status
            }
            // stop at first test failure, break the loop
            if (log.status === "FAIL") {
                break;
            }
        }
    }

    // close the browser, if instance exists
    if (type === "browser" && runner.browser !== null) {
        await runner.browserClose();
    }

    // console.log(runner.metrics);
    // console.log(runner.response);

    // add duration & final status to the output
    Object.assign(log, {
        // if no steps logged or any step failed, it's a fail
        status:
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
