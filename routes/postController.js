const postController = require("express").Router();
const { body, validationResult } = require("express-validator");
const mongoose = require('mongoose');
const Post = require('../models/post');
const mediaUploader = require('../config/mediaUploader');
const fs = require('fs');
const path = require('path');
postController.get('/:id', async (req,res, next) =>{
   const {id} = req.params;
    Post.findById(mongoose.Types.ObjectId(id), {__v: 0}).populate({path: 'author', select: '-confirmed -password -__v -posts -friends'}).exec((err, post)=>{
        if(err) next(err);
        else if(!post) return res.status(404).json('post does not exist');
       return res.status(200).json(post);
    });
});
postController.post('/create',
    mediaUploader.array('media') ,
    [
        body("content")
            .notEmpty({ignore_whitespace: true})
            .withMessage("content is a required field with at least a character")
    ],(req,res,next)=>{
        const {content} = req.body;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res
                .status(400)
                .json({ errors: errors.array().map((err) => err.msg) });
        }
        const post = new Post({
            author: req.user,
            content: content,
            likes: [],
            comments: [],
        });
        if (req.files){
            req.files.map((file, index) => {
                post.media[index] = "/media/" + file.filename
            });
        }
        post.save((err, post) =>{
            if(err) next(err);
            return res.status(200).json({post});
        });
    });
postController.delete('/:id', (req,res,next)=>{
    const {id} = req.params;
    Post.findByIdAndDelete(mongoose.Types.ObjectId(id), {},(err,post)=>{
        if(err) next(err);
        else if(!post) return res.status(404).json('post does not exist');
        else if(String(req.user) !== String(post.author)) return res.status(403).json('forbidden');
        else res.status(200).json('deleted post successfully')
    });
});
postController.put('/:id',
    mediaUploader.array('media') ,
    [
        body("content")
            .notEmpty({ignore_whitespace: true})
            .withMessage("content is a required field with at least a character")
    ],async (req,res,next)=>{
    const {id}  = req.params;
    const post = await Post.findById(mongoose.Types.ObjectId(id));
    if(String(req.user) !== String(post.author)) return res.status(403).json('forbidden');
    else if(!post) return res.status(404).json('post does not exist');
        const {content, deletedFiles} = req.body;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res
                .status(400)
                .json({ errors: errors.array().map((err) => err.msg) });
        }
        if(deletedFiles && deletedFiles.length > 0){
            deletedFiles.map(media => {
                try{
                    fs.unlinkSync(path.resolve(__dirname, "../uploads/" + media));
                    post.media = post.media.filter(oldMedia=> oldMedia !== media);
                }catch (e) {
                    if(e.code === 'ENOENT'){
                        return res.status(404).json('file does not exist');
                    }
                    next(e)
                }
            });
        }
        if (req.files){
            req.files.map((file, index) => {
                post.media[post.media.length] = "/media/" + file.filename
            });
        }
        Post.findOneAndUpdate({_id: mongoose.Types.ObjectId(id)}, {post, content, media: post.media}, {new: true}, (err, newPost) => {
            if (err) next(err);
            res.status(200).json(newPost);
        });

    });

module.exports = postController;