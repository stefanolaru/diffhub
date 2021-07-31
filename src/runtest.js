const runner = require("./lib/runner-basic"),
    mock = require("../mockdata/test.json");

exports.handler = async (event) => {
    await runner
        .run(mock.steps)
        .then((res) => {
            console.log(res);
        })
        .catch((err) => {
            console.log(err);
        });

    return true;
};
