const postController = require("express").Router();
const mongoose = require('mongoose');
const Post = require('../models/post');
const mediaUploader = require('../config/mediaUploader');
const cloudinary = require('cloudinary').v2;
const {ObjectId} = mongoose.Types;

postController.get('/:id', async (req,res, next) =>{
   const {id} = req.params;
    if(!ObjectId.isValid(id)) return res.status(400).json('id is not valid');
    Post.findById(ObjectId(id), {__v: 0}).lean().populate({path: 'author', select: '-confirmed -password -__v -avatarId -forgetCode -forgetCodeExpires -friends'}).exec((err, post)=>{
        if(err) next(err);
        else if(!post) return res.status(404).json('post does not exist');
       return res.status(200).json(post);
    });
});
postController.post('/create',
    mediaUploader.array('media') ,
    (req,res,next)=>{
        const {content} = req.body;
        if(!content && !req.files) return res.status(400).json('must sent text or media files');
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
    if(!ObjectId.isValid(id)) return res.status(400).json('id is not valid');
    try{
        const post = await Post.findById(ObjectId(id)).lean();
        if(!post) return res.status(404).json('post does not exist');
        else if(String(req.user) !== String(post.author)) return res.status(403).json('forbidden');
        if(post.media.length > 0){
            post.media.map(async (media) => await cloudinary.uploader.destroy(media.title));
        }
        await Post.deleteOne({_id: ObjectId(id)});
        res.status(200).json('deleted post successfully')

    }catch (e) {
        next(e);
    }
});
postController.put('/:id',
    async (req,res,next) =>{
        const {id} = req.params;
        if(!ObjectId.isValid(id)) return res.status(400).json('id is not valid');
        const post = await Post.findById(ObjectId(id)).lean();
        req.post = post;
        if(!post) return res.status(404).json('post does not exist');
        else if(String(req.user) !== String(post.author)) return res.status(403).json('forbidden');
        else next();
    },
    mediaUploader.array('media') ,async (req,res,next)=>{
    const {id}  = req.params;
    const {post} = req;
    const {content, deletedFiles} = req.body;
    if(!content && !req.files) return res.status(400).json('must sent text or media files');

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

        Post.findOneAndUpdate({_id: ObjectId(id)}, {post, content, media: post.media}, {new: true}, (err, newPost) => {
            if (err) next(err);
            res.status(200).json(newPost);
        });

    });

module.exports = postController;