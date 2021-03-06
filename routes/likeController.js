const likeController = require("express").Router();
const mongoose = require('mongoose');
const Post = require('../models/post');
const Notification = require('../models/notification');
const {ObjectId} = mongoose.Types;
const asyncHandler = require('express-async-handler');


likeController.put('/post/:id', asyncHandler(async (req,res,next)=>{
    const {id} = req.params;
    const {user} = req;
    const post = await Post.findById(ObjectId(id));
    if(!post) return res.status(404).json('post does not exist');
    if(!ObjectId.isValid(id)) return res.status(400).json('id is not valid');
    else if(post.likes.indexOf(user) > -1){
        Post.updateOne({_id: ObjectId(id)}, {$pull: {likes: {$in: [user]}}}, (err, post)=>{
            if(err) next(err);
            return res.status(200).json('does not like');
        });
    }
    else {
        Post.updateOne({_id: ObjectId(id)}, {$addToSet: {likes: user}}, async (err, newPost) => {
            if (err) next(err);
            else if(String(post.author) !== String(user)){
                    const duplicateNotification = await Notification.findOne(
                        {$and: [{by: ObjectId(user)}, {post: ObjectId(id)}, {type: 'like'}]}).lean();
                    if(!duplicateNotification){
                        const notification = new Notification({
                            receiver: ObjectId(post.author),
                            by: ObjectId(user),
                            post: ObjectId(id),
                            type: 'like',
                        });
                        const notificationSave = await notification.save();
                        if(!notificationSave) next(new Error('something wrong when trying to save the notification'));
                        return res.status(200).json('liked');
                    }else{
                        return res.status(200).json('liked');
                    }
            }
            return res.status(200).json('liked');

        });
    }
}));
likeController.get('/:id', asyncHandler(async (req,res,next)=>{
    const {id} = req.params;
    if(!ObjectId.isValid(id)) return res.status(400).json('id is not valid');
        Post.findById(ObjectId(id)).lean().populate({path: 'likes', select: '-confirmed -password -__v, -friends -forgetCode -forgetCodeExpires -avatarId'}).exec((err, post)=>{
            if(err) next(err);
            else if(!post) return res.status(404).json('post does not exist');
            res.status(200).json(post.likes);
        });
}));

module.exports = likeController;