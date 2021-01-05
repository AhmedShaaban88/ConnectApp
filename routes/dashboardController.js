const dashboardController = require("express").Router();
const Posts = require("../models/post");
const mongoose = require('mongoose');
const {dashboardIo} = require('../config/socket');
const newFeed = require('../utils/newFeed');
dashboardIo.on('connect', async (socket) =>{
    const newPostNotifiy = Posts.watch([ { $match : {"operationType" : "insert" } }], { fullDocument : "updateLookup" });
    newPostNotifiy.once('change', async next => {
        try {
            const newPost = await newFeed(next.fullDocument._id, socket);
            if(newPost.length > 0){
                const resumeToken = next._id;
                if (resumeToken) {
                    socket.emit('new-post', newPost[0]);
                    newPostNotifiy.close();
                    const newChangeStream = Posts.watch([ { $match : {"operationType" : "insert" } }], { fullDocument : "updateLookup", startAfter: resumeToken });
                    newChangeStream.on('change', async data => {
                        const newPost = await newFeed(data.fullDocument._id, socket);
                        if(newPost.length > 0){
                            socket.emit('new-post', newPost[0]);
                        }
                    });
                }
            }
            socket.on('seen', () => socket.emit('seen all', 0));
        }catch (e) {
            socket.disconnect()
        }
    });

});

dashboardController.get('/', async (req,res,next)=>{
    const {limit, skip} = req.query;
    let currentLimit = parseInt(limit);
    let currentSkip = parseInt(skip);
    if(limit < 8 || !Boolean(currentLimit)) currentLimit =8;
    if(skip < 0 || !Boolean(currentSkip)) currentSkip =0;
    const posts = Posts.aggregate([
        {$lookup: {
                from: 'FriendShip',
                pipeline:[
                    {$match: {
                            $and: [{requester: mongoose.Types.ObjectId(req.user)}, {status: {$eq: 3}}]}
                        }
                ],
                as: 'friends'
            }},
        {$match: {$or: [{"$expr": { "$in": [ "$author", "$friends.recipient" ] }}, {author: mongoose.Types.ObjectId(req.user)}]}},
        {$project: {__v: 0, friends: 0}},
        {
            $lookup: {
                from: 'User',
                localField: 'author',
                foreignField: '_id',
                as: 'author'
            }},
        {$unwind: '$author'},
        {$project: {'author.__v': 0, 'author.friends': 0, 'author.confirmed': 0, 'author.password': 0, 'author.avatarId': 0, 'author.forgetCode': 0, 'author.forgetCodeExpires': 0}}
    ]);
    Posts.aggregatePaginate(posts, {limit: currentLimit, offset: currentSkip, sort: {'updated_at': -1}}, (err, result) =>{
        if(err) next(err);
        res.status(200).json(result)
    })
});


module.exports = dashboardController;