const messagesController = require('express').Router();
const mongoose = require('mongoose');
const Room = require('../models/room');
const Message = require('../models/message');
const User = require('../models/user');
const messageUploader = require('../config/messageUploader');
const {messageIo} = require('../config/socket');
const {ObjectId} = mongoose.Types;
messageIo.on('connect', async (socket) =>{
    const userId = ObjectId(socket.userId);
    let unreadMessages = await Message.countDocuments({$and: [
            {receiver: userId}, {seen: {$ne: userId}}]});
    if(isNaN(unreadMessages)) socket.disconnect();
    socket.emit('count', unreadMessages);
    const newMessageNotifiy = Message.watch([ { $match : {$and:[
        {$or: [{"operationType" : "insert"}, {"operationType" : "update"}]}
        , {'fullDocument.receiver': ObjectId(socket.userId)}] } }], { fullDocument : "updateLookup" });
    newMessageNotifiy.once('change', async next => {
        try {
            if(next.operationType === 'insert'){
                unreadMessages++;
            }else if(unreadMessages > 0){
                unreadMessages--;
            }
                socket.emit('count', unreadMessages);
                const resumeToken = next._id;
                if (resumeToken) {
                    newMessageNotifiy.close();
                    const newChangeStream = Message.watch([ { $match : {$and:[
                                {$or: [{"operationType" : "insert"}, {"operationType" : "update"}]}
                                , {'fullDocument.receiver': ObjectId(socket.userId)}] } }], { fullDocument : "updateLookup" });

                    newChangeStream.on('change', async data => {
                        if(data.operationType === 'insert'){
                            unreadMessages++;
                        }else if(unreadMessages > 0){
                            unreadMessages--;
                        }
                            socket.emit('count', unreadMessages);
                    });
                }
        }catch (e) {
            socket.disconnect()
        }
    });
});
messagesController.post('/send-message/:id',
    messageUploader.array('media') ,
    async (req,res,next) => {
    const {id} = req.params;
        if(!ObjectId.isValid(id)) return res.status(400).json('id is not valid');
        const {content} = req.body;
    if(!content && !req.files) return res.status(400).json('must sent text or media files');
    const friendId = ObjectId(id);
    const userId = ObjectId(req.user);
    const room = await Room.findOne({participants: {$all: [userId, friendId]}});
    if(!room) return res.status(404).json('no room between these users');
    const message = new Message({
        sender: userId,
        receiver: friendId,
        roomId: room._id,
        content: content,
    });
        if (req.files){
            req.files.map((file, index) => {
                message.media = message.media.concat({path: file.path, title: file.filename});
            });
        }
        message.save(async (err, message) =>{
            if(err) next(err);
            const {sender, receiver, content, media, delivered_at, roomId, _id} = message;
            const updateRoom = await Room.updateOne({_id: room._id}, {lastMessage: message._id});
            if(!updateRoom) return res.status(400).json('something wrong happen with the chat room');
            return res.status(200).json({
                _id,
                sender,
                receiver,
                content,
                media,
                roomId,
                delivered_at
            });
        });

});
messagesController.put('/seen/:id', async (req,res,next)=>{
    const {id} = req.params;
    if(!id) return res.status(400).json('id is required');
    else if(!ObjectId.isValid(id)) return res.status(400).json('id is not valid');
    try{
        const message = await Message.findByIdAndUpdate(ObjectId(id), {seen: ObjectId(req.user)}, {new: true});
        if(!message) return res.status(404).json('this message does not exist');
        return res.status(200).json(message);
    }catch (e) {
        next(e)
    }


});
messagesController.get('/rooms', async (req,res,next)=>{
    let {limit, skip} = req.query;
    let currentSkip = parseInt(skip);
    let currentLimit = parseInt(limit);
    if(limit < 5 || !Boolean(currentLimit)) currentLimit =5;
    if(skip < 0 || !Boolean(currentSkip)) currentSkip =0;
    const rooms = await Room.paginate({participants: {$in: [req.user]}},
        {limit: currentLimit, offset: currentSkip,
            sort: {updatedAt: -1},
            select: {participants: {$elemMatch: {$ne: req.user}}},
            populate: [{
            path: 'lastMessage',
            select: '-receiver -roomId -updatedAt -__v -media',
            },{
            path: 'participants',
            select: '-confirmed -password -__v -friends -forgetCode -forgetCodeExpires -avatarId'
            }]});
    res.status(200).json(rooms)
});

messagesController.get('/:id', async (req,res,next)=>{
    const {id} = req.params;
    let {limit, skip} = req.query;
    let currentLimit = parseInt(limit);
    let currentSkip = parseInt(skip);
    if(limit < 5 || !Boolean(currentLimit)) currentLimit =5;
    if(skip < 0 || !Boolean(currentSkip)) currentSkip =0;
    if(!ObjectId.isValid(id) || !id) return res.status(400).json('id is not valid');
    const friendId = ObjectId(id);
    const friend = await User.findById(friendId).select('-confirmed -friends -password -forgetCode -forgetCodeExpires -__v');
    if(!friend) return res.status(404).json('this user does not exist');
    const userId = ObjectId(req.user);
    if(String(id) === String(req.user)) return res.status(400).json('you can not chat with yourself');
    const room = await Room.findOne({participants: {$all: [userId, friendId]}});
              if(!room){
                  const newRoom = new Room({
                      participants: [friendId, userId]
                  });
                  const newRoomDoc = await newRoom.save();
                  if(!newRoomDoc) next(new Error('something wrong when trying to save the chat room'));
                  try {
                      return res.status(200).json('create room successfully');
                  } catch (err) {
                      next(err)
                  }
              }else{
                  try {
                     const messages =  await Message.paginate({roomId: ObjectId(room._id)},
                         {select: '-__v -updatedAt -roomId', limit: currentLimit,
                             offset: currentSkip,
                             sort: {'delivered_at': -1}});
                     return res.status(200).json({...messages, friend: friend, roomId: room._id});
                  } catch (err) {
                      next(err)
                  }
              }



});

module.exports = messagesController;