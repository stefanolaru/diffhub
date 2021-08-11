const chromium = require("chrome-aws-lambda"),
    testRunner = require("./runner");

class browserRunner extends testRunner {
    async browserOpen() {
        try {
            // start browser
            this.browser = await chromium.puppeteer.launch({
                args: chromium.args,
                executablePath: await chromium.executablePath,
                headless: chromium.headless,
            });

            // open new page
            this.page = await this.browser.newPage();

            // set page interceptors
            this._pageInterceptors();

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
        // update metrics duration
        let { Timestamp } = await this.page.metrics();
        this.metrics.duration = Math.ceil(
            (Timestamp - this.metrics.start_time) * 1000
        );
        //
        console.log(this.metrics);
        await this.browser.close();
    }
    //
    _pageInterceptors() {
        // stop if no page available
        if (this.page === null) return;
        // intercept page requests
        this.page.on("response", async (res) => {
            // get the document response
            if (
                res.request().resourceType() === "document" &&
                res.status() === 200
            ) {
                this.response = {
                    status: res.status(),
                    statusText: res.statusText(),
                    url: res.url(),
                    headers: res.headers(),
                };
            }
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
        return await this.page.authenticate(step);
    }
    // set extra http header
    async header(step) {
        // set headers
        return await this.page.setExtraHTTPHeaders(step);
    }
    // set geolocation
    async geolocation(step) {
        // set geolocation
        return await this.page.setGeolocation(step);
    }
    // set user agent
    async useragent(step) {
        // set geolocation
        return await this.page
            .setUserAgent(step)
            .then()
            .catch((err) => Promise.reject(err.message));
    }
    // set viewport size
    async viewport(step) {
        return await this.page
            .setViewport(step)
            .then()
            .catch((err) => Promise.reject(err.message));
    }
    // navigate
    async navigate(step) {
        // reset metrics for every page
        let { Timestamp } = await this.page.metrics();
        this.metrics.start_time = Timestamp;

        // add default navigation config
        Object.assign(step, {
            waitUntil: step.waitUntil || ["domcontentloaded", "networkidle2"],
            timeout: step.timeout || 5000,
        });
        //
        return await this.page
            .goto(step.url, step)
            .then()
            .catch((err) => Promise.reject(err.message));
    }
    // type text into input
    async type(step) {
        return await this.page
            .type(step.subject, step.text, step.options || {})
            .then()
            .catch((err) => Promise.reject(err.message));
    }
    // page reload
    async reload(step) {
        // add default navigation config
        Object.assign(step, {
            waitUntil: step.waitUntil || ["domcontentloaded", "networkidle2"],
            timeout: step.timeout || 5000,
        });
        return await this.page
            .reload(step)
            .then()
            .catch((err) => Promise.reject(err.message));
    }

    async click(step) {
        return step.navigate
            ? await Promise.all([
                  this.page.click(step.subject),
                  this.page.waitForNavigation({
                      waitUntil: step.waitUntil || ["networkidle2"],
                      timeout: step.timeout || 5000,
                  }),
              ])
            : await this.page.click(step.subject);
    }

    async waitForTimeout(step) {
        return await this.page.waitForTimeout(step.timeout);
    }

    async waitForSelector(step) {
        return await this.page.waitForSelector(step.subject, step.options);
    }

    // get the assertion subject
    // subject can be a string (selector) or array [selector, property, args]
    // can be a DOM element or a DOM element property
    async getSubject(params) {
        // if it's a string, just return the selector
        if (typeof params === "string") {
            return Promise.resolve(params);
        }
        // destructure params
        const [selector, property, value] = params;
        // console.log(selector, property, value);
        const r = await this.page.evaluate(
            (selector, property, value) => {
                const el = document.querySelector(selector);
                //
                if (el) {
                    if (property) {
                        if (value) {
                            return el[property](value);
                        }
                        return el[property];
                    }
                }
                return el;
            },
            selector,
            property,
            value
        );

        return r;
    }
}

module.exports = browserRunner;
