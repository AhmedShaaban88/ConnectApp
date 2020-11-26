const Posts = require("../models/post");
const mongoose = require('mongoose');
const newFeed = (id, socket) => {
    return Posts.aggregate([
        {$match: {_id: id}},
        {
            $lookup: {
                from: 'FriendShip',
                pipeline: [
                    {
                        $match: {
                            $and: [{requester: mongoose.Types.ObjectId(socket.userId)}, {status: {$eq: 3}}]
                        }
                    }
                ],
                as: 'friends'
            }
        },
        {$match: {"$expr": {"$in": ["$author", "$friends.recipient"]}}},
        {$project: {__v: 0, friends: 0}},
        {
            $lookup: {
                from: 'User',
                localField: 'author',
                foreignField: '_id',
                as: 'author'
            }
        },
        {$unwind: '$author'},
        {
            $project: {
                'author.__v': 0,
                'author.friends': 0,
                'author.confirmed': 0,
                'author.password': 0,
                'author.avatarId': 0
            }
        }
    ]);
};

module.exports = newFeed;