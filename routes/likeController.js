const likeController = require("express").Router();
const mongoose = require('mongoose');
const Post = require('../models/post');
likeController.put('/post/:id', async (req,res,next)=>{
    const {id} = req.params;
    const {user} = req;
    const post = await Post.findById(mongoose.Types.ObjectId(id));
    if(!post) return res.status(404).json('post does not exist');
    else if(post.likes.indexOf(user) > -1){
        Post.updateOne({_id: mongoose.Types.ObjectId(id)}, {$pull: {likes: {$in: [user]}}}, (err, post)=>{
            if(err) next(err);
            return res.status(200).json('does not like');
        });
    }
    else {
        Post.updateOne({_id: mongoose.Types.ObjectId(id)}, {$addToSet: {likes: user}}, (err, post) => {
            if (err) next(err);
            return res.status(200).json('liked');
        });
    }
});
likeController.get('/:id', async (req,res,next)=>{
    const {id} = req.params;
        Post.findById(mongoose.Types.ObjectId(id)).populate({path: 'likes', select: '-confirmed -password -__v, -friends -avatarId'}).exec((err, post)=>{
            if(err) next(err);
            else if(!post) return res.status(404).json('post does not exist');
            res.status(200).json(post.likes);
        });
});

module.exports = likeController;