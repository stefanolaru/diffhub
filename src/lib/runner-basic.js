const axios = require("axios"),
    TestRunner = require("../lib/runner");

const mockdata = require("../../mockdata/test.json");
/**
 * Basic test run, does HTTP request using Axios
 * requires test data & log
 * returns the log updated with the test results
 */
module.exports.run = async (data, log) => {
    // instantiate the test runner
    const runner = new basicRunner();

    data = mockdata;

    // add start time to the log
    Object.assign(log, {
        started_at: Date.now(),
        steps: [], // and empty steps
    });

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

    // add duration & final status to the output
    Object.assign(log, {
        status: log.status !== "FAIL" ? "PASS" : "FAIL", // if it didn't fail, it's a PASS, doh!
        duration: Math.round(Date.now() - log.started_at),
    });

    // return promise resolve/reject
    return log.status === "PASS" ? Promise.resolve(log) : Promise.reject(log);
};

class basicRunner extends TestRunner {
    // axios makes the http request
    async navigate(step) {
        return new Promise((resolve) => {
            // create the axios interceptors
            // add start time before request is made
            axios.interceptors.request.use((config) => {
                this.metrics["start_time"] = Date.now();
                return config;
            });
            // add end time & duration on response
            axios.interceptors.response.use((response) => {
                this.metrics["duration"] = Date.now() - this.metrics.start_time;
                return response;
            });

            // enforce a 5 seconds timeout if not otherwise specified
            if (typeof step.config.timeout === "undefined") {
                Object.assign(step.config, {
                    timeout: 5000,
                });
            }

            // return the axios promise
            axios(step.config)
                .then((res) => {
                    // populate the response
                    this.response = res;
                    resolve();
                })
                .catch((err) => {
                    // populate the response
                    this.response = err;
                    // resolve anyway, assertions will do the rest
                    resolve();
                });
        });
    }
}
