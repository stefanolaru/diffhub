const axios = require("axios"),
    expect = require("expect"),
    uuid = require("uuid/v4");

module.exports.run = async (steps) => {
    // prepare the output
    const output = {
        id: uuid(), // unique id for the test run
        start_time: Date.now(),
        pass: true, // assume it will pass
        steps: [],
    };

    // instantiate the test runner
    const runner = new basicRunner();

    // loop test steps
    while (steps.length) {
        const step = steps.shift();
        try {
            await runner[step.action](step)
                .then(() => {
                    // add passed step to the output
                    output.steps.push(
                        Object.assign(step, {
                            pass: true,
                        })
                    );
                })
                .catch((err) => {
                    // add failed step to the output
                    output.steps.push(
                        Object.assign(step, {
                            pass: false,
                        })
                    );
                    // log the err for the CloudWatch logs
                    console.log(err);
                    // update the output with the overall status
                    Object.assign(output, {
                        pass: false,
                    });
                });
        } catch (e) {
            // log the err for the CloudWatch logs
            console.log(e);
            // update the output with the overall status
            Object.assign(output, {
                pass: false,
            });
        }
        // stop at first test failure, break the loop
        if (output.pass === false) {
            break;
        }
    }

    // add duration to the output
    Object.assign(output, {
        duration: Math.round(Date.now() - output.start_time),
    });

    // return promise resolve/reject
    return output.pass === true
        ? Promise.resolve(output)
        : Promise.reject(output);
};

class basicRunner {
    // constructor
    constructor() {
        // instantiate request response
        this.response = null;
    }
    //
    async navigate(step) {
        return new Promise((resolve) => {
            // create the axios interceptors
            // add start time before request is made
            axios.interceptors.request.use((config) => {
                config["__start_time"] = Date.now();
                return config;
            });
            // add end time & duration on response
            axios.interceptors.response.use((response) => {
                response["duration"] =
                    Date.now() - response.config.__start_time;
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
                    // resolve anyway
                    resolve();
                })
                .catch((err) => {
                    // populate the response
                    this.response = err;
                    // resolve even if error
                    resolve();
                });
        });
    }

    async expect(step) {
        return new Promise((resolve, reject) => {
            // get expect components
            let [subject, matcher, value] = step.matcher;

            // if no subject or matcher, ignore assertion, resolve early
            if (!subject || !matcher) {
                resolve();
            }

            // extract the subject path from response
            // works for dotted notation i.e. response.headers.content-type
            subject = subject.split(".").reduce((o, i) => o[i], this.response);

            // run the Jest test
            try {
                expect(subject)[matcher](value);
                // resolve
                resolve();
            } catch (e) {
                // console.log(e.message);
                // reject
                reject(e.message);
            }
        });
    }
}
