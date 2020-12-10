const notificationController = require("express").Router();
const mongoose = require('mongoose');
const Notification = require('../models/notification');
const {notificationsIo} = require('../config/socket');
const {ObjectId} = mongoose.Types;
notificationsIo.on('connect', async (socket) =>{
    let notificationCount = await Notification.countDocuments({$and: [
        {receiver: ObjectId(socket.userId)}, {seen: false}]});
    if(isNaN(notificationCount)) socket.disconnect();
    socket.emit('count', notificationCount);
    const postNotifiy = Notification.watch([ { $match : {$and: [{"operationType" : "insert" }, {'fullDocument.receiver': ObjectId(socket.userId)}]} }], { fullDocument : "updateLookup" });
    postNotifiy.once('change', async next => {
       const notification =  await Notification.findById(ObjectId(next.fullDocument._id)).populate({
            path: 'by',
            select: '-confirmed -friends -password -__v'
        }).select('-__v -updatedAt -expires').exec();
       if(!notification) socket.disconnect();
                const resumeToken = next._id;
                if (resumeToken) {
                    notificationCount++;
                    socket.emit('count', notificationCount);
                    socket.emit('notification', notification);
                    postNotifiy.close();
                    const newChangeStream = Notification.watch([ { $match : {$and: [{"operationType" : "insert" }, {'fullDocument.receiver': ObjectId(socket.userId)}]}}], { fullDocument : "updateLookup", startAfter: resumeToken });
                    newChangeStream.on('change', async data => {
                        const newNotification = await Notification.findById(ObjectId(data.fullDocument._id)).populate({
                            path: 'by',
                            select: '-confirmed -friends -password -__v'
                        }).select('-__v -updatedAt -expires').exec();
                        if(!newNotification) socket.disconnect();
                        notificationCount++;
                        socket.emit('count', notificationCount);
                        socket.emit('notification', newNotification)
                    });
                }

    });
    socket.on('seen', id => {
        Notification.findOneAndUpdate({$and: [{_id: ObjectId(id)}, {seen: false}]}, {seen: true}, (err, result) => {
            if(err) socket.disconnect();
            if(result){
                notificationCount--;
                socket.emit('count', notificationCount);
            }
        });
    });
    socket.on('seenAll', ()=>{
        if(notificationCount > 0){
            Notification.updateMany({$and: [{receiver: ObjectId(socket.userId)}, {seen: false}]}, {seen: true}, (err, results) =>{
                if(err) socket.disconnect();
                notificationCount = 0;
                socket.emit('count', notificationCount);
            });
        }
    })

});

notificationController.get('/', (req,res,next)=>{
    const {page, limit} = req.query;
    let currentPage = parseInt(page);
    let currentLimit = parseInt(limit);
    if(limit < 10 || !Boolean(currentLimit)) currentLimit =10;
    if(page < 1 || !Boolean(currentPage)) currentPage =1;
    Notification.paginate({receiver: ObjectId(req.user)},
        {select: '-expires -updatedAt -__v', limit: currentLimit, page: currentPage, sort: {'notified_at': -1}, populate: {
                path: 'by',
                select: '-confirmed -friends -password -__v'
            }}, (err, results) => {
            if(err) next(err);
            res.status(200).json(results);
        });

});



module.exports = notificationController;