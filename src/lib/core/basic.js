const axios = require("axios"),
    testRunner = require("./runner");

class basicRunner extends testRunner {
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
            if (typeof step.timeout === "undefined") {
                Object.assign(step, {
                    timeout: 5000,
                });
            }

            // remove "action" or "context" keys
            delete step.action;
            delete step.context;

            // return the axios promise
            axios(step)
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

module.exports = basicRunner;
