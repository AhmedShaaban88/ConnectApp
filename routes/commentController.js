const commentController = require("express").Router();
const {body, validationResult} = require("express-validator");
const mongoose = require('mongoose');
const Post = require('../models/post');
const Comment = require('../models/comment');
const mediaUploader = require('../config/mediaUploader');
const fs = require('fs');
const path = require('path');
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
             {limit: currentLimit, page: currentPage, select: '-__v -post', sort: {'updated_at': -1}}, (err, comments)=> {
             if(err) next(err);
             res.status(200).json(comments);
             })
    }catch (e) {
       next(e);
    }

});
commentController.put('/:id',
    mediaUploader.array('media'),
    [
        body("content")
            .notEmpty({ignore_whitespace: true})
            .withMessage("content is a required field with at least a character")
    ], async (req, res, next) => {
        const {content} = req.body;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res
                .status(400)
                .json({errors: errors.array().map((err) => err.msg)});
        }
        const {id} = req.params;
        const comment = new Comment({
            content: content,
            author: req.user,
            post: mongoose.Types.ObjectId(id)
        });
        if (req.files) {
            req.files.map((file, index) => {
                comment.media[index] = "/media/" + file.filename
            });
        }
        comment.save((err, comment) =>{
            if (err) next(err);
            Post.findOneAndUpdate({_id: mongoose.Types.ObjectId(id)}, {$push: {comments: comment}}, (err, post) => {
                if (err) next(err);
                else if (!post) return res.status(404).json('post does not exist');
                return res.status(200).json(comment);
            });
        });

    });
commentController.delete('/:id', async (req, res, next) => {
    const {id} = req.params;
    const {commentId} = req.body;
    const post = await Post.findById(mongoose.Types.ObjectId(id));
    if (!post) return res.status(404).json('post does not exist');
    const requiredComment = post.comments.filter(comment => String(comment) === String(commentId));
    if (requiredComment.length === 0) {
        return res.status(404).json('comment does not exist');
    }
    if (String(req.user) !== String(post.author) && String(req.user) !== String(requiredComment[0].author))
        return res.status(403).json('forbidden');

    Post.findByIdAndUpdate({_id: mongoose.Types.ObjectId(id)}, {$pull: {comments: commentId}}, {new: true}, (err, post) => {
        if (err) next(err);
        Comment.findByIdAndRemove(mongoose.Types.ObjectId(commentId), (err, comment)=>{
            if(err) next(err);
            return res.status(200).json(post);
        });
    });

});
commentController.put('/edit/:id',
    mediaUploader.array('media'),
    [
        body("content")
            .notEmpty({ignore_whitespace: true})
            .withMessage("content is a required field with at least a character")
    ], async (req, res, next) => {
    try{
        const {id} = req.params;
        const {commentId, content, deletedFiles} = req.body;
        const comment = await Comment.findOne({$and:[{_id: mongoose.Types.ObjectId(commentId)}, {author: mongoose.Types.ObjectId(req.user)}]});
        if(!comment) return res.status(404).json('comment does not exist');
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res
                .status(400)
                .json({errors: errors.array().map((err) => err.msg)});
        }
        if (deletedFiles && deletedFiles.length > 0) {
            deletedFiles.map(media => {
                try {
                    fs.unlinkSync(path.resolve(__dirname, "../uploads/" + media));
                    comment.media = comment.media.filter(oldMedia => oldMedia !== media);
                } catch (e) {
                    if (e.code === 'ENOENT') {
                        return res.status(404).json('file is not exist');
                    }
                    next(e)
                }
            });
        }
        if (req.files) {
            req.files.map((file, index) => {
                comment.media = comment.media.concat(["/media/" + file.filename]);
            });
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