const runner = require("./lib/runner-basic"),
    mock = require("../mockdata/test.json"),
    vars = require("../mockdata/variables.json");

exports.handler = async (event) => {
    // console.log(JSON.parse(JSON.stringify(mock)));

    // stringify mock data
    let data = JSON.stringify(mock);

    // replace variables
    data = data.replace(new RegExp(/\{{(.*?)}}/gm), (x, y) => {
        // has env variable, replace it
        if (typeof vars[y] !== "undefined") {
            return vars[y];
        }
        // doesn't have a variable, return the exact string as populated
        return x;
    });

    // parse back the data
    data = JSON.parse(data);

    await runner
        .run(data.steps)
        .then((res) => {
            console.log(res);
        })
        .catch((err) => {
            console.log(err);
        });

    return true;
};
