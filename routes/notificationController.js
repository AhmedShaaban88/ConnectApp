const notificationController = require("express").Router();
const mongoose = require('mongoose');
const Notification = require('../models/notification');
const {notificationsIo} = require('../config/socket');

notificationsIo.on('connect', async (socket) =>{
    let notificationCount = await Notification.countDocuments({$and: [
        {receiver: mongoose.Types.ObjectId(socket.userId)}, {seen: false}]});
    if(isNaN(notificationCount)) socket.disconnect();
    socket.emit('count', notificationCount);
    const postNotifiy = Notification.watch([ { $match : {"operationType" : "insert" } }], { fullDocument : "updateLookup" });
    postNotifiy.once('change', async next => {
       const notification =  await Notification.findById(mongoose.Types.ObjectId(next.fullDocument._id)).populate({
            path: 'by',
            select: '-confirmed -friends -password -__v'
        }).select('-__v -updatedAt -expires').exec();
       if(!notification) socket.disconnect();
        if(String(notification.receiver) === String(socket.userId)){
                const resumeToken = next._id;
                if (resumeToken) {
                    notificationCount++;
                    socket.emit('count', notificationCount);
                    socket.emit('notification', notification);
                    postNotifiy.close();
                    const newChangeStream = Notification.watch([ { $match : {"operationType" : "insert" } }], { fullDocument : "updateLookup", startAfter: resumeToken });
                    newChangeStream.on('change', async data => {
                        const newNotification = await Notification.findById(mongoose.Types.ObjectId(data.fullDocument._id)).populate({
                            path: 'by',
                            select: '-confirmed -friends -password -__v'
                        }).select('-__v -updatedAt -expires').exec();
                        if(!newNotification) socket.disconnect();

                        notificationCount++;
                        socket.emit('count', notificationCount);
                        socket.emit('notification', newNotification)
                    });
                }
            }

    });
    socket.on('seen', id => {
        Notification.findOneAndUpdate({$and: [{_id: mongoose.Types.ObjectId(id)}, {seen: false}]}, {seen: true}, (err, result) => {
            if(err) socket.disconnect();
            if(result){
                notificationCount--;
                socket.emit('count', notificationCount);
            }
        });
    });
    socket.on('seenAll', ()=>{
        if(notificationCount > 0){
            Notification.updateMany({$and: [{receiver: mongoose.Types.ObjectId(socket.userId)}, {seen: false}]}, {seen: true}, (err, results) =>{
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
    if(limit < 10) currentLimit =10;
    if(page < 1) currentPage =1;
    Notification.paginate({receiver: mongoose.Types.ObjectId(req.user)},
        {select: '-expires -updatedAt -__v', limit: currentLimit, page: currentPage, sort: {'notified_at': -1}, populate: {
                path: 'by',
                select: '-confirmed -friends -password -__v'
            }}, (err, results) => {
            if(err) next(err);
            res.status(200).json(results);
        });

});



module.exports = notificationController;