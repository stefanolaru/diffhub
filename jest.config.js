module.exports = {
    testEnvironment: "node",
    verbose: true,
    testMatch: ["**/*.test.js"],
    transform: {
        "^.+\\.[t|j]sx?$": "babel-jest",
    },
    // projects: ["<rootDir>", "<rootDir>/*"],
};
