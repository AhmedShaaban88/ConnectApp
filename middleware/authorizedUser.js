const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

function authorizedUser(req,res,next) {
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    if(!token) return res.status(401).end('unauthorized');
    fs.readFile(path.resolve(__dirname, '../config/public.key'), {encoding: 'utf8'}, (err, key) =>{
        if(err) next(err);
        jwt.verify(token, key, {}, function (err, decoded) {
            if(err) next(err);
            req.user = decoded.userId;
            next()
        });
    });
}
module.exports = authorizedUser;