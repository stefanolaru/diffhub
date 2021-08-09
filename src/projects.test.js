const yaml = require("js-yaml"),
    fs = require("fs"),
    axios = require("axios");

// set env
beforeAll(() => {
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
});

describe("Projects CRUD API test (w/ API key)", () => {
    //
    var project_id = null,
        updated_name = "My updated project";

    // create project
    it("Should create a new project", async () => {
        expect(project_id).toBeNull();
        const res = await axios.post(
            process.env.api_endpoint + "/projects",
            JSON.stringify({
                name: "My new project",
                // set the expires flag for tests, 24h TTL
                expires_at: Math.round(+new Date() / 1000) + 3600 * 24,
            })
        );
        expect(res.status).toBe(200);
        expect(res.data.id).toBeDefined();
        // populate project_id
        project_id = res.data.id;
        console.log(project_id);
    });
    // test patch
    it("Should update project with updated_name value", async () => {
        expect(project_id).not.toBeNull();
        const res = await axios
            .patch(
                process.env.api_endpoint + "/projects/" + project_id,
                JSON.stringify({
                    name: updated_name,
                })
            )
            .then()
            .catch((err) => {
                console.log(err);
            });
        expect(res.status).toBe(200);
        expect(res.data).toBeTruthy();
    });
    // GET by id
    it("Should return the project object", async () => {
        expect(project_id).not.toBeNull();
        const res = await axios.get(
            process.env.api_endpoint + "/projects/" + project_id
        );
        expect(res.status).toBe(200);
        expect(res.data.id).toBeDefined();
        expect(res.data.name).toBe(updated_name);
    });
    // GET a list
    it("Should return an array of objects and contain the newly created project", async () => {
        const res = await axios.get(process.env.api_endpoint + "/projects");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.data)).toBeTruthy();
        expect(res.data.find((x) => x.id === project_id)).not.toBeNull();
    });
    // DELETE
    it("Should delete the newly created project", async () => {
        expect(project_id).not.toBeNull();
        const res = await axios.delete(
            process.env.api_endpoint + "/projects/" + project_id
        );
        expect(res.status).toBe(200);
        expect(res.data).toBeTruthy();
    });
});
