const jwt = require('jsonwebtoken');
function authorizedUser(req,res,next) {
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    if(!token) return res.status(401).end('unauthorized');
    jwt.verify(token, process.env.PUBLIC_KEY_TOKEN, {}, function (err, decoded) {
        if(err) next(err);
        req.user = decoded.userId;
        next()
    });
}

module.exports = authorizedUser;