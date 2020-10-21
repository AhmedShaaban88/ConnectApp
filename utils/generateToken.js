const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

function generateToken(payload, cb) {
    const options = {
        issuer: 'Connect App',
        audience: 'http://localhost',
        subject: payload.email ? payload.email : payload.phone,
        expiresIn: '7d',
        algorithm: 'RS256'
    };
    fs.readFile(path.resolve(__dirname, '../config/private.key'), {encoding: 'utf8'}, (err, key)=>{
        if(err) return err;
        return jwt.sign(payload, key, options, (err, token) => {
            if(err) cb(err, null);
            cb(null, token);
        });
    });

}

module.exports = generateToken;