const yaml = require("js-yaml"),
    fs = require("fs"),
    axios = require("axios"),
    basic_test_data = require("../mockdata/test.json");

var project_id = null,
    test_id = null;

// set env
beforeAll(async () => {
    // read env.yml
    let config;
    try {
        const d = yaml.load(fs.readFileSync("./env.yml", "utf8"));
        config = d["default"];
    } catch (e) {
        console.log(e);
    }
    process.env = Object.assign(process.env, config);

    // set the axios header
    axios.defaults.headers.common["x-api-key"] = process.env.api_key;

    // create the project
    project_id = await axios
        .post(
            process.env.api_endpoint + "/projects",
            JSON.stringify({
                name: "My new project",
                // set the expires flag for tests, 24h TTL
                expires_at: Math.round(+new Date() / 1000) + 3600 * 24,
            })
        )
        .then((res) => res.data.id)
        .catch((err) => null);
    // log into console
    console.log("Project ID:", project_id);
});

// delete the project
afterAll(async () => {
    // delete the project
    if (project_id) {
        await axios.delete(
            process.env.api_endpoint + "/projects/" + project_id
        );
    }
    // delete the test
    if (test_id) {
        await axios.delete(process.env.api_endpoint + "/tests/" + test_id);
    }
});

describe("Tests CRUD API test (w/ API key)", () => {
    // check project_id
    it("Should have project_id populated", () => {
        expect(project_id).not.toBeNull();
    });
    // create a basic test
    it("Should create a basic test", async () => {
        const res = await axios
            .post(
                process.env.api_endpoint + "/tests",
                JSON.stringify(
                    Object.assign(basic_test_data, {
                        project_id: project_id,
                        // set the expires flag for tests, 24h TTL
                        expires_at: Math.round(+new Date() / 1000) + 3600 * 24,
                    })
                )
            )
            .then()
            .catch((err) => {
                console.log(err);
            });
        expect(res.status).toBe(200);
        expect(res.data.id).toBeDefined();
        // populate project_id
        test_id = res.data.id;
        console.log("Test ID:", test_id);
    });
    // update a basic test
    it("Should update a basic test", async () => {
        expect(test_id).not.toBeNull();
        const res = await axios.patch(
            process.env.api_endpoint + "/tests/" + test_id,
            JSON.stringify({
                trigger: "manual",
            })
        );
        expect(res.status).toBe(200);
        expect(res.data).toBeTruthy();
    });
    // GET by id
    it("Should return the test object", async () => {
        expect(test_id).not.toBeNull();
        const res = await axios.get(
            process.env.api_endpoint + "/tests/" + test_id
        );
        expect(res.status).toBe(200);
        expect(res.data.id).toBeDefined();
        expect(res.data.trigger).toBe("manual");
    });
    // GET a list
    it("Should return a list of test objects", async () => {
        expect(test_id).not.toBeNull();
        const res = await axios.get(process.env.api_endpoint + "/tests");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.data)).toBeTruthy();
    });
    // GET a list from project
    it("Should return a list of test objects from a specific project", async () => {
        expect(test_id).not.toBeNull();
        const res = await axios.get(process.env.api_endpoint + "/tests", {
            params: {
                project_id: project_id,
            },
        });
        expect(res.status).toBe(200);
        expect(Array.isArray(res.data)).toBeTruthy();
    });
    // DELETE
    it("Should delete the newly created test", async () => {
        const res = await axios.delete(
            process.env.api_endpoint + "/tests/" + test_id
        );
        expect(res.status).toBe(200);
        expect(res.data).toBeTruthy();
        // set back to null
        test_id = null;
    });
});
