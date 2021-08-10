const crypto = require("crypto");
const algorithm = "aes-256-ctr",
    iv = crypto.randomBytes(16);

module.exports.encrypt = (string, key) => {
    const cipher = crypto.createCipheriv(algorithm, key, iv),
        encrypted = Buffer.concat([cipher.update(string), cipher.final()]);

    return {
        iv: iv.toString("hex"),
        content: encrypted.toString("hex"),
    };
};

module.exports.decrypt = (hash, key) => {
    const decipher = crypto.createDecipheriv(
        algorithm,
        key,
        Buffer.from(hash.iv, "hex")
    );

    const decrpyted = Buffer.concat([
        decipher.update(Buffer.from(hash.content, "hex")),
        decipher.final(),
    ]);

    return decrpyted.toString();
};
