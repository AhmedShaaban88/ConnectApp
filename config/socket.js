const jwt = require('jsonwebtoken');
const io = require('socket.io')({
    perMessageDeflate: false
});
const auth = ((socket, next) => {
    const token = socket.handshake.query ? socket.handshake.query.token.split(' ')[1] : null;
    if(!token) socket.disconnect();
    jwt.verify(token, process.env.PUBLIC_KEY_TOKEN, {}, function (err, decoded) {
        if(err) {
            socket.disconnect();
            next(new Error('unauthorized user'));
        }
        socket.userId = decoded ? decoded.userId : null
    });
    next()
});
const notificationsIo = io.of('/notifications').use(auth);
const dashboardIo = io.of('/dashboard').use(auth);
const friendsIo = io.of('/friends').use(auth);
const messageIo = io.of('/messages').use(auth);
const messengerIo = io.of('/messenger').use(auth);
module.exports = {io,dashboardIo, notificationsIo, friendsIo, messageIo, messengerIo};