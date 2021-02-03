const friendShipController = require('express').Router();
const mongoose = require('mongoose');
const FriendShip = require('../models/friendship');
const User = require('../models/user');
const Notification = require('../models/notification');
const {friendsIo} = require('../config/socket');
const {ObjectId} = mongoose.Types;
const asyncHandler = require('express-async-handler');

friendsIo.on('connect', async (socket) =>{
    let friendShipCount = await FriendShip.countDocuments({$and: [
            {requester: ObjectId(socket.userId)}, {status: 2}]});
    if(isNaN(friendShipCount)) socket.disconnect();
    socket.emit('count', friendShipCount);
    const newFriendNotifiy = FriendShip.watch([ { $match : {$and:
                [{"operationType" : "insert"}, {'fullDocument.status': 2}, {'fullDocument.requester': ObjectId(socket.userId)}] } }], { fullDocument : "updateLookup" });
    newFriendNotifiy.once('change', async next => {
        try {
                const resumeToken = next._id;
                if (resumeToken) {
                    const newFriend = await FriendShip.findById(ObjectId(next.fullDocument._id)).lean().populate({
                        path: 'recipient',
                        select: '-confirmed -friends -password -forgetCode -forgetCodeExpires -__v'
                    }).select('-__v -status').exec();
                    if(newFriend){
                        friendShipCount++;
                        socket.emit('count', friendShipCount);
                        socket.emit('new-friend', newFriend);
                    }
                    newFriendNotifiy.close();
                    const newChangeStream = FriendShip.watch([ {$match: {$and:[{"operationType" : "insert"}, {'fullDocument.status': 2}, {'fullDocument.requester': ObjectId(socket.userId)}] }}], { fullDocument : "updateLookup", startAfter: resumeToken });
                    newChangeStream.on('change', async data => {
                            const newFriend = await FriendShip.findById(ObjectId(data.fullDocument._id)).lean().populate({
                                path: 'recipient',
                                select: '-confirmed -friends -password -forgetCode -forgetCodeExpires -__v'
                            }).select('-__v -status').exec();
                            if(newFriend){
                                friendShipCount++;
                                socket.emit('count', friendShipCount);
                                socket.emit('new-friend', newFriend);
                            }

                    });
                }
        }catch (e) {
            socket.disconnect()
        }
    });
    socket.on('decrease-count', () => {
        if(friendShipCount > 0){
            friendShipCount--;
            socket.emit('count', friendShipCount);
        }
    });

});
friendShipController.put('/add', asyncHandler(async (req,res)=>{
    const {recipient} = req.body;
    const requester = req.user;
    if(!requester || !recipient) return res.status(400).json('both requester, recipient are required');
    else if(requester === recipient) return res.status(409).json('you can not send a friend request to yourself');
        const friendShipRequester = await FriendShip.findOneAndUpdate(
            { requester: ObjectId(requester), recipient: ObjectId(recipient) },
            { status: 1 },
            { upsert: true, new: true }
        );
        const friendShipRecipient = await FriendShip.findOneAndUpdate(
            { requester: ObjectId(recipient), recipient: ObjectId(requester) },
            { status: 2 },
            { upsert: true, new: true }
        );
        await User.findByIdAndUpdate(
            ObjectId(requester),
            { $addToSet: { friends: friendShipRequester._id }}
        );
       await User.findByIdAndUpdate(
            ObjectId(recipient),
            { $addToSet: { friends: friendShipRecipient._id }}
        );
        return res.status(200).json('add a new friend successfully');

}));
friendShipController.put('/remove', asyncHandler(async (req,res,next)=>{
    const {recipient} = req.body;
    const requester = req.user;
    if(!requester || !recipient) return res.status(400).json('both requester, recipient are required');
    else if(requester === recipient) return res.status(409).json('you can not remove a friend request from yourself');
        const friendShipRequester = await FriendShip.findOneAndRemove(
            { requester: ObjectId(requester), recipient: ObjectId(recipient) }
        );
        const friendShipRecipient = await FriendShip.findOneAndRemove(
            { requester: ObjectId(recipient), recipient: ObjectId(requester) }
        );
        if(!friendShipRequester || !friendShipRecipient) return res.status(403).json('forbidden');
        await User.findByIdAndUpdate(
            ObjectId(requester),
            { $pull: { friends: friendShipRequester._id }}
        );
        await User.findByIdAndUpdate(
            ObjectId(recipient),
            { $pull: { friends: friendShipRecipient._id }}
        );
        return res.status(200).json('remove a friend successfully');

}));
friendShipController.put('/accept', asyncHandler(async (req,res,next)=>{
    const {recipient} = req.body;
    const requester = req.user;
    if(!requester || !recipient) return res.status(400).json('both requester, recipient are required');
    else if(requester === recipient) return res.status(409).json('you can not accept yourself');
    const friendShipDoc = await FriendShip.findOne(
        {requester: ObjectId(requester), recipient: ObjectId(recipient), status: 2}
        ).lean();
    if(friendShipDoc){
            await FriendShip.findOneAndUpdate(
                { requester: ObjectId(recipient), recipient: ObjectId(requester) },
                {status: 3}
            );
            await FriendShip.findOneAndUpdate(
                { requester: ObjectId(requester), recipient: ObjectId(recipient) },
                {status: 3},
            );
            const notification = new Notification({
                receiver: ObjectId(recipient),
                by: ObjectId(requester),
                type: 'friend',
            });
            const notificationSave = await notification.save();
            if(!notificationSave) next(new Error('something wrong when trying to save the notification'));

        if(String(friendShipDoc.requester) !== String(requester))
            return res.status(403).json('forbidden');
        return res.status(200).json('accept a friend successfully');
    }
    return res.status(404).json('this relationship not found');

}));
friendShipController.get('/friends/:id', asyncHandler(async (req,res,next)=>{
    const {id} = req.params;
    if(!id) return res.status(400).json('User id required');
    else if(!ObjectId.isValid(id)) return res.status(400).json('id is not valid');
    let {limit, page} = req.query;
  let currentPage = parseInt(page);
  let currentLimit = parseInt(limit);
  if(limit < 5 || !Boolean(currentLimit)) currentLimit =5;
  if(page < 1 || !Boolean(currentPage)) currentPage =1;
        FriendShip.paginate({$and:[
                {"requester": ObjectId(id)},
                {"status":  3 }
            ]}, {select: '-requester -__v -status', limit: currentLimit, page: currentPage,populate: { path: 'recipient',
                select: '-confirmed -password -__v -friends -forgetCode -forgetCodeExpires -avatarId'}}, (err, results)=>{
            res.status(200).json(results);
        });
}));
friendShipController.get('/search', asyncHandler(async (req,res,next)=>{
  let {q,limit, page} = req.query;
    let currentPage = parseInt(page);
    let currentLimit = parseInt(limit);
    if(limit < 5 || !Boolean(currentLimit)) currentLimit =5;
    if(page < 1 || !Boolean(currentPage)) currentPage =1;
    const keyword = q.trim();
        if(!keyword) return res.status(400).json('please enter your keyword');
       User.paginate({ $text: { $search: keyword} },
           {select: {score: {$meta: 'textScore'}, confirmed: 0, friends: 0, forgetCode: 0, forgetCodeExpires: 0,
                   verifyCode: 0, verifyCodeExpires: 0, password: 0, __v: 0},
               sort: { score: { $meta: "textScore" }}, limit: currentLimit, page: currentPage}, (err, results)=>{
           if(err) next(err);
           else if(results.total === 0){
               User.paginate({$or: [{name: {$regex: keyword, $options: 'ix'} }, {email: {$regex: keyword, $options: 'ix'} }, {phone: {$regex: keyword, $options: 'ix'} }]},
                   {select: {confirmed: 0, friends: 0,forgetCode: 0, forgetCodeExpires: 0,
                           verifyCode: 0, verifyCodeExpires: 0, password: 0, __v: 0, avatarId: 0},
                   limit: currentLimit, page: currentPage}, (err, result)=>{
                       if(err) next(err);
                       res.status(200).json(result)
                   });
           }else{
               res.status(200).json(results)
           }
           });

}));
friendShipController.get('/requests', asyncHandler(async (req,res,next)=>{
    let {limit, skip} = req.query;
    let currentSkip = parseInt(skip);
    let currentLimit = parseInt(limit);
    if(limit < 5 || !Boolean(currentLimit)) currentLimit =5;
    if(skip < 0 || !Boolean(currentSkip)) currentSkip =0;
        FriendShip.paginate({$and:[
                {"requester": ObjectId(req.user)},
                {"status":  2 }
            ]}, {select: '-requester -__v -status', limit: currentLimit,offset: currentSkip,populate: { path: 'recipient',
                select: '-confirmed -password -__v -friends -forgetCode -forgetCodeExpires -avatarId'}}, (err, results)=>{
            res.status(200).json(results);
        });

}));

module.exports = friendShipController;