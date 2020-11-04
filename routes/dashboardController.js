const dashboardController = require("express").Router();
const Posts = require("../models/post");
const mongoose = require('mongoose');

dashboardController.get('/', async (req,res,next)=>{
    const {page, limit} = req.query;
    let currentPage = parseInt(page);
    let currentLimit = parseInt(limit);
    if(limit < 10) currentLimit =10;
    if(page < 1) currentPage =1;
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
        {$project: {'author.__v': 0, 'author.friends': 0, 'author.confirmed': 0, 'author.password': 0, 'author.avatarId': 0}}
    ]);
    Posts.aggregatePaginate(posts, {limit: currentLimit, page: currentPage, sort: {'updated_at': -1}}, (err, result) =>{
        if(err) next(err);
        res.status(200).json(result)
    })
});


module.exports = dashboardController;