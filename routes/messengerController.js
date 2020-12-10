const messengerController = require('express').Router();
const mongoose = require('mongoose');
const Room = require('../models/room');
const Message = require('../models/message');
const {messengerIo} = require('../config/socket');
const ObjectId = mongoose.Types.ObjectId;
messengerIo.on('connect', async (socket) =>{
    const userId = ObjectId(socket.userId);
    socket.on('join', async room => {
        socket.join(room);
        try {
           const updateMessages = await Message.updateMany({$and: [{roomId: ObjectId(room)}, {seen: {$ne: userId}}, {receiver: userId}]}, {seen: userId});
            if(updateMessages.nModified > 0){
                messengerIo.to(room).emit('seen all', ({length: updateMessages.nModified, user: socket.userId}));
                await Room.updateOne({_id: ObjectId(room)}, {updatedAt: new Date()});
            }
        }catch (e) {
            socket.disconnect();
        }
    });
    socket.on('leave', room => socket.leave(room));
    socket.on('disconnecting', function(){
        const rooms = Array.from(socket.rooms);
        rooms.forEach(function(room){
            socket.leave(room);
        });
    });
    socket.on('typing', room => socket.broadcast.to(room).emit('user typing', `typing...`));
    socket.on('send message', (message) => {
        socket.broadcast.to(String(message.roomId)).emit('new message', message)
    });
    socket.on('seen message', message => socket.broadcast.to(String(message.roomId)).emit('seen', ({id: message._id, user: socket.userId})));
    let roomsNotify = Room.watch([ { $match : {$and:[{"operationType" : "update" }, {'fullDocument.participants': {$in: [ObjectId(socket.userId)]}}]}}], { fullDocument : "updateLookup" });
    roomsNotify.once('change', async next => {
        try {
                const lastMessage = await Room.findById(ObjectId(next.fullDocument._id)).populate({
                    path: 'participants',
                    match: {_id: {$ne: userId}},
                    select: '-confirmed -password -__v -friends -avatarId'
                }).populate({
                    path: 'lastMessage',
                    select: '-receiver -roomId -updatedAt -__v -media',
                }).select('-createdAt -__v');
                socket.emit('room update', lastMessage);
                const resumeToken = next._id;
                if (resumeToken) {
                    roomsNotify.close();
                    const newChangeStream = Room.watch([ { $match : {$and:[{"operationType" : "update" }, {'fullDocument.participants': {$in: [ObjectId(socket.userId)]}}]}}], { fullDocument : "updateLookup", startAfter: resumeToken });
                    newChangeStream.on('change', async data => {
                            const lastMessage = await Room.findById(ObjectId(data.fullDocument._id)).populate({
                                path: 'participants',
                                match: {_id: {$ne: userId}},
                                select: '-confirmed -password -__v -friends -avatarId'
                            }).populate({
                                path: 'lastMessage',
                                select: '-receiver -roomId -updatedAt -__v -media',
                            }).select('-createdAt -__v');
                            socket.emit('room update', lastMessage);
                    });
                }
        }catch (e) {
            socket.disconnect()
        }
    });
});

module.exports = messengerController;