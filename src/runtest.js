const runner = require("./lib/run-basic"),
    mock = require("../mockdata/test1.json");

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
