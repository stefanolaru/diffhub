const jwt = require("jsonwebtoken"),
    jwkToPem = require("jwk-to-pem"),
    axios = require("axios");

exports.handler = async (event, context, callback) => {
    const token = event.authorizationToken;
    if (!token) {
        callback("Missing authorization token");
    }

    let decoded,
        verify = false;

    try {
        // decode token
        decoded = jwt.decode(token, { complete: true });
        // console.log(decoded);
        const {
            header: { kid },
            payload: { iss },
        } = decoded;
        // init jwks client
        const jwks = await axios
            .get(iss + "/.well-known/jwks.json")
            .then((res) => res.data)
            .catch((err) => null);
        // console.log(jwks);
        const jwk = jwks.keys.find((x) => x.kid === kid),
            pem = jwkToPem(jwk);
        // verify token
        jwt.verify(
            token,
            pem,
            { algorithms: ["RS256"] },
            (err, decoded_token) => {
                if (decoded_token) {
                    verify = true;
                } else {
                    console.log(err);
                }
            }
        );
    } catch (e) {
        console.log("token invalid");
    }

    callback(
        null,
        generatePolicy("user", verify ? "Allow" : "Deny", event.methodArn)
    );

    // callback("Unauthorized");
};

const generatePolicy = (principalId, effect, resource) => {
    return {
        principalId: principalId,
        policyDocument: {
            Version: "2012-10-17",
            Statement: [
                {
                    Action: "execute-api:Invoke",
                    Effect: effect,
                    Resource: resource,
                },
            ],
        },
    };
};
