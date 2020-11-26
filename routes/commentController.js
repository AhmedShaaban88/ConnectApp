const commentController = require("express").Router();
const {body, validationResult} = require("express-validator");
const mongoose = require('mongoose');
const Post = require('../models/post');
const Comment = require('../models/comment');
const Notification = require('../models/notification');
const mediaUploader = require('../config/mediaUploader');
const cloudinary = require('cloudinary').v2;

commentController.get('/:id', async (req,res,next)=>{
    const {id} = req.params;
    let {limit, page} = req.query;
    let currentPage = parseInt(page);
    let currentLimit = parseInt(limit);
    if(limit < 5) currentLimit =5;
    if(page < 1) currentPage =1;
    if(!id) return res.status(400).json('post id is required');
    try{
         Comment.paginate({post: mongoose.Types.ObjectId(id)},
             {limit: currentLimit, page: currentPage, select: '-__v -post', sort: {'updated_at': -1},
                 populate: {path: 'author', select: '-confirmed -password -__v -avatarId -friends'}}, (err, comments)=> {
             if(err) next(err);
             res.status(200).json(comments);
             })
    }catch (e) {
       next(e);
    }

});
commentController.put('/:id',
    async (req,res,next) =>{
        const {id} = req.params;
        const post = await Post.findById(mongoose.Types.ObjectId(id));
        if(!post) return res.status(404).json('post does not exist');
        else next();
    },
    mediaUploader.array('media'),
    [
        body("content")
            .notEmpty({ignore_whitespace: true})
            .withMessage("content is a required field with at least a character")
    ], async (req, res, next) => {
        const {content} = req.body;
        const {id} = req.params;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            if (req.files) {
                return req.files.map(async (media) => await cloudinary.uploader.destroy(media.filename)).then(r => res
                    .status(400)
                    .json({errors: errors.array().map((err) => err.msg)})).catch(e => next(e));
            }
            return res
                .status(400)
                .json({errors: errors.array().map((err) => err.msg)});
        }
        const comment = new Comment({
            content: content,
            author: req.user,
            post: mongoose.Types.ObjectId(id)
        });
        if (req.files) {
            req.files.map((file, index) => {
                comment.media = comment.media.concat({path: file.path, title: file.filename});
            });
        }
        comment.save((err, comment) => {
            if (err) next(err);
            Post.findOneAndUpdate({_id: mongoose.Types.ObjectId(id)}, {$push: {comments: comment}}, async (err, post) => {
                if (err) next(err);
                else if (String(post.author) !== String(req.user)) {
                    try {
                        const notification = new Notification({
                            receiver: mongoose.Types.ObjectId(post.author),
                            by: mongoose.Types.ObjectId(req.user),
                            post: mongoose.Types.ObjectId(id),
                            type: 'comment',
                        });
                        const notificationSave = await notification.save();
                        if (!notificationSave) next(new Error('something wrong when trying to save the notification'));
                        return res.status(200).json(comment);
                    } catch (e) {
                        next(e)
                    }
                    return res.status(200).json(comment);
                }
            });
        });
    });
commentController.delete('/:id', async (req, res, next) => {
    const {id} = req.params;
    const {commentId} = req.body;
    const post = await Post.findById(mongoose.Types.ObjectId(id));
    if (!post) return res.status(404).json('post does not exist');
    const comment = await Comment.findById(mongoose.Types.ObjectId(commentId));
    if(!comment) return res.status(404).json('comment does not exist');
    if (String(req.user) !== String(post.author) && String(req.user) !== String(comment.author))
        return res.status(403).json('forbidden');
    Post.findByIdAndUpdate({_id: mongoose.Types.ObjectId(id)}, {$pull: {comments: commentId}}, {new: true}, (err, post) => {
        if (err) next(err);
        if(comment.media.length > 0){
            comment.media.map(async (media) => await cloudinary.uploader.destroy(media.title));
        }
        comment.remove((err, doc) => {
            if(err) next(err);
            return res.status(200).json(post);
        });
    });

});
commentController.put('/edit/:id/:commentId',
    async (req,res,next) =>{
        const {commentId} = req.params;
        const comment = await Comment.findOne({$and:[{_id: mongoose.Types.ObjectId(commentId)}, {author: mongoose.Types.ObjectId(req.user)}]});
        req.comment = comment;
        if(!comment) return res.status(404).json('comment does not exist');
        else next();
    },
    mediaUploader.array('media'),
    [
        body("content")
            .notEmpty({ignore_whitespace: true})
            .withMessage("content is a required field with at least a character")
    ], async (req, res, next) => {
    try{
        const {id, commentId} = req.params;
        const {content, deletedFiles} = req.body;
        const {comment} =req;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            if(req.files){
                return req.files.map(async (media) => await cloudinary.uploader.destroy(media.filename)).then(r => res
                    .status(400)
                    .json({ errors: errors.array().map((err) => err.msg) })).catch(e => next(e));
            }
            return res
                .status(400)
                .json({errors: errors.array().map((err) => err.msg)});
        }
        if (deletedFiles && deletedFiles.length > 0) {
            deletedFiles.map(media => {
                try{
                    cloudinary.uploader.destroy(media);
                    comment.media = comment.media.filter(oldMedia => oldMedia.title !== media);
                }catch (e) {
                    next(e)
                }
            });
        }
        if (req.files) {
            req.files.map(async (media) => comment.media = comment.media.concat({path: media.path, title: media.filename}));
        }
        comment.content = content;
        Post.updateOne({_id: mongoose.Types.ObjectId(id)}, { $set: { "comments.$[comment]": commentId }} ,{arrayFilters: [ { comment: commentId } ]}, (err, post) => {
            if (err) next(err);
            Comment.findByIdAndUpdate(mongoose.Types.ObjectId(commentId),comment ,{new: true}, function(err, comment) {
                if(err) next(err);
                res.status(200).json(comment)
            })
        });
    }
            catch (e) {
        next(e)
    }
    });

module.exports = commentController;