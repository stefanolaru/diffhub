const expect = require("expect"),
    matchers = require("../lib/matchers");

expect.extend(matchers);

class TestRunner {
    constructor() {
        // browser & page
        this.browser = null;
        this.page = null;

        // the page response
        this.response = null;

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
    // Jest expect handles the assertions
    async expect(step) {
        // destructure assertion components
        let { subject, matcher, value } = step;

        // if no subject or matcher, ignore assertion, resolve early
        if (!subject || !matcher) {
            return Promise.resolve();
        }

        // extract the subject path from response
        // works for dotted notation i.e. response.headers.content-type
        let context = this.response;

        switch (step.context) {
            case "document":
                context = this.page;
                break;
            case "metrix":
                context = this.metrics;
                break;
            case "resource":
                context = this.resources;
                break;
        }

        if (step.context !== "document") {
            // split object notation
            subject = subject.split(".").reduce((o, i) => o[i], context);
        } else {
            subject = await this.getSubject(subject);
        }

        return new Promise((resolve, reject) => {
            // run the Jest test
            // console.log(subject, matcher, value);
            try {
                // check for negation
                if (matcher.startsWith("not.")) {
                    // remove the not.
                    matcher = matcher.replace("not.", "");
                    // pass the context for custom matchers
                    if (matchers[matcher]) {
                        expect(subject).not[matcher](context, value);
                    } else {
                        expect(subject).not[matcher](value);
                    }
                } else {
                    if (matchers[matcher]) {
                        expect(subject)[matcher](context, value);
                    } else {
                        expect(subject)[matcher](value);
                    }
                }
                // resolve
                resolve();
            } catch (e) {
                // reject
                reject(e.message);
            }
        });
    }
}

module.exports = TestRunner;
