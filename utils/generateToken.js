const jwt = require('jsonwebtoken');

function generateToken(payload, cb) {
    const options = {
        issuer: 'Connect App',
        // audience: 'http://localhost',
        subject: payload.email ? payload.email : payload.phone,
        expiresIn: '7d',
        algorithm: 'RS256'
    };
    return jwt.sign(payload, process.env.PRIVATE_KEY_TOKEN, options, (err, token) => {
        if(err) cb(err, null);
        cb(null, token);
    });
}
module.exports = generateToken;