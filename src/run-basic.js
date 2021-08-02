const Test = require("./lib/entities/test"),
    Log = require("./lib/entities/log"),
    Project = require("./lib/entities/project"),
    runner = require("./lib/runner-basic");

// basic test function
// we assume what got here was previously checked by the triggering function
exports.handler = async (event) => {
    //
    console.log("Basic test run.", event);

    let { data, log } = event;

    // stop if test or log is missing
    if (!data || !log) return false;

    // get project data (variables & notifications)
    const project = await Project.get(data.project_id)
        .then((res) => res)
        .catch((err) => err);

    // project missing, stop execution, this shouldn't run
    if (!project.id)
        return Object.assign(log, {
            status: "FAIL",
            message: project,
        });

    // replace project variables
    data = Test.replaceVars(data, project.variables);

    // trigger the runner, update the log with the test results
    log = await runner
        .run(data, log)
        .then((res) => res)
        .catch((err) => err);

    // update the log with the test results
    await Log.update(log)
        .then()
        .catch((err) => {
            console.log(err);
        });

    // do what's needed based on the result

    console.log(log);

    return false;
};
