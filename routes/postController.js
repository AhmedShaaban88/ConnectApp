const postController = require("express").Router();
const { body, validationResult } = require("express-validator");
const mongoose = require('mongoose');
const Post = require('../models/post');
const mediaUploader = require('../config/mediaUploader');
const cloudinary = require('cloudinary').v2;

postController.get('/:id', async (req,res, next) =>{
   const {id} = req.params;
    Post.findById(mongoose.Types.ObjectId(id), {__v: 0}).populate({path: 'author', select: '-confirmed -password -__v -avatarId -friends'}).exec((err, post)=>{
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
            if(req.files){
                return req.files.map(async (media) => await cloudinary.uploader.destroy(media.filename)).then(r => res
                    .status(400)
                    .json({ errors: errors.array().map((err) => err.msg) })).catch(e => next(e));
            }
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
               post.media = post.media.concat({path: file.path, title: file.filename});
            });
        }
        post.save((err, post) =>{
            if(err) next(err);
            return res.status(200).json({post});
        });
    });
postController.delete('/:id', async (req,res,next)=>{
    const {id} = req.params;
    try{
        const post = await Post.findById(mongoose.Types.ObjectId(id));
        if(!post) return res.status(404).json('post does not exist');
        else if(String(req.user) !== String(post.author)) return res.status(403).json('forbidden');
        if(post.media.length > 0){
            post.media.map(async (media) => await cloudinary.uploader.destroy(media.title));
        }
        await Post.deleteOne({_id: mongoose.Types.ObjectId(id)});
        res.status(200).json('deleted post successfully')

    }catch (e) {
        next(e);
    }
});
postController.put('/:id',
    async (req,res,next) =>{
        const {id} = req.params;
        const post = await Post.findById(mongoose.Types.ObjectId(id));
        req.post = post;
        if(!post) return res.status(404).json('post does not exist');
        else if(String(req.user) !== String(post.author)) return res.status(403).json('forbidden');
        else next();
    },
    mediaUploader.array('media') ,
    [
        body("content")
            .notEmpty({ignore_whitespace: true})
            .withMessage("content is a required field with at least a character")
    ],async (req,res,next)=>{
    const {id}  = req.params;
    const {post} = req;
    const {content, deletedFiles} = req.body;
    const errors = validationResult(req);
        if (!errors.isEmpty()) {
            if(req.files){
                return req.files.map(async (media) => await cloudinary.uploader.destroy(media.filename)).then(r => res
                    .status(400)
                    .json({ errors: errors.array().map((err) => err.msg) })).catch(e => next(e));
            }
            return res
                .status(400)
                .json({ errors: errors.array().map((err) => err.msg) });
        }
        if(deletedFiles && deletedFiles.length > 0){
            deletedFiles.map((media) => {
                try{
                    cloudinary.uploader.destroy(media);
                    post.media = post.media.filter(oldMedia => oldMedia.title !== media);
                }catch (e) {
                    next(e)
                }
            });
        }
        if (req.files){
            req.files.map(async (media) => post.media = post.media.concat({path: media.path, title: media.filename}));
        }

        Post.findOneAndUpdate({_id: mongoose.Types.ObjectId(id)}, {post, content, media: post.media}, {new: true}, (err, newPost) => {
            if (err) next(err);
            res.status(200).json(newPost);
        });

    });

module.exports = postController;