const commentController = require("express").Router();
const mongoose = require('mongoose');
const Post = require('../models/post');
const Comment = require('../models/comment');
const Notification = require('../models/notification');
const mediaUploader = require('../config/mediaUploader');
const cloudinary = require('cloudinary').v2;
const {ObjectId} = mongoose.Types;

commentController.get('/:id', async (req,res,next)=>{
    const {id} = req.params;
    if(!ObjectId.isValid(id)) return res.status(400).json('id is not valid');
    let {limit, skip} = req.query;
    let currentSkip = parseInt(skip);
    let currentLimit = parseInt(limit);
    if(limit < 5 || !Boolean(currentLimit)) currentLimit =5;
    if(skip < 0 || !Boolean(currentSkip)) currentSkip =0;
    if(!id) return res.status(400).json('post id is required');
    try{
         Comment.paginate({post: ObjectId(id)},
             {limit: currentLimit, offset: currentSkip, select: '-__v -post', sort: {'updated_at': -1},
                 populate: {path: 'author', select: '-confirmed -password -__v -avatarId -friends -forgetCode -forgetCodeExpires'}}, (err, comments)=> {
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
        if(!ObjectId.isValid(id)) return res.status(400).json('id is not valid');
        const post = await Post.findById(ObjectId(id));
        if(!post) return res.status(404).json('post does not exist');
        else next();
    },
    mediaUploader.array('media')
    , async (req, res, next) => {
        const {content} = req.body;
        const {id} = req.params;
        if(!content && !req.files) return res.status(400).json('must sent text or media files');
        const comment = new Comment({
            content: content,
            author: req.user,
            post: ObjectId(id)
        });
        if (req.files) {
            req.files.map((file, index) => {
                comment.media = comment.media.concat({path: file.path, title: file.filename});
            });
        }
        comment.save((err, comment) => {
            if (err) next(err);
            Post.findOneAndUpdate({_id: ObjectId(id)}, {$push: {comments: comment}}, async (err, post) => {
                if (err) next(err);
                else if (String(post.author) !== String(req.user)) {
                    try {
                        const notification = new Notification({
                            receiver: ObjectId(post.author),
                            by: ObjectId(req.user),
                            post: ObjectId(id),
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
    if(!ObjectId.isValid(id)) return res.status(400).json('id is not valid');
    const {commentId} = req.body;
    const post = await Post.findById(ObjectId(id));
    if (!post) return res.status(404).json('post does not exist');
    const comment = await Comment.findById(ObjectId(commentId));
    if(!comment) return res.status(404).json('comment does not exist');
    if (String(req.user) !== String(post.author) && String(req.user) !== String(comment.author))
        return res.status(403).json('forbidden');
    Post.findByIdAndUpdate({_id: ObjectId(id)}, {$pull: {comments: commentId}}, {new: true}, (err, post) => {
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
        const comment = await Comment.findOne({$and:[{_id: ObjectId(commentId)}, {author: ObjectId(req.user)}]});
        req.comment = comment;
        if(!comment) return res.status(404).json('comment does not exist');
        else next();
    },
    mediaUploader.array('media'),
    async (req, res, next) => {
    try{
        const {id, commentId} = req.params;
        if(!ObjectId.isValid(id)) return res.status(400).json('id is not valid');
        const {content, deletedFiles} = req.body;
        const {comment} =req;
        if(!content && !req.files) return res.status(400).json('must sent text or media files');
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
        Post.updateOne({_id: ObjectId(id)}, { $set: { "comments.$[comment]": commentId }} ,{arrayFilters: [ { comment: commentId } ]}, (err, post) => {
            if (err) next(err);
            Comment.findByIdAndUpdate(ObjectId(commentId),comment ,{new: true}, function(err, comment) {
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