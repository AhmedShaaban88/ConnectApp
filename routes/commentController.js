const commentController = require("express").Router();
const {body, validationResult} = require("express-validator");
const mongoose = require('mongoose');
const Post = require('../models/post');
const mediaUploader = require('../config/mediaUploader');
const fs = require('fs');
const path = require('path');
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
        const comment = {
            author: req.user,
            content: content,
            _id: new mongoose.Types.ObjectId(),
            media: [],
        };
        if (req.files) {
            req.files.map((file, index) => {
                comment.media[index] = "/media/" + file.filename
            });
        }
        Post.findOneAndUpdate({_id: mongoose.Types.ObjectId(id)}, {$push: {comments: comment}}, {new: true}, (err, post) => {
            if (err) next(err);
            else if (!post) return res.status(404).json('post does not exist');
            return res.status(200).json(post);
        });
    });
commentController.delete('/:id', async (req, res, next) => {
    const {id} = req.params;
    const {commentId} = req.body;
    const post = await Post.findById(mongoose.Types.ObjectId(id));
    if (!post) return res.status(404).json('post does not exist');
    const requiredComment = post.comments.filter(comment => String(comment._id) === commentId);
    if (String(req.user) !== String(post.author) && String(req.user) !== String(requiredComment[0].author)) return res.status(403).json('forbidden');
    if (requiredComment.length === 0) {
        return res.status(404).json('comment does not exist');
    }
    const comments = post.comments.filter((comment) => String(comment._id) !== commentId);
    Post.findOneAndUpdate({_id: mongoose.Types.ObjectId(id)}, {comments: comments}, {new: true}, (err, post) => {
        if (err) next(err);
        return res.status(200).json(post);
    });

});
commentController.put('/edit/:id',
    mediaUploader.array('media'),
    [
        body("content")
            .notEmpty({ignore_whitespace: true})
            .withMessage("content is a required field with at least a character")
    ], async (req, res, next) => {
        const {id} = req.params;
        const {commentId, content, deletedFiles} = req.body;
        const post = await Post.findById(mongoose.Types.ObjectId(id));
        if (!post) return res.status(404).json('post does not exist');
        else if(!commentId) return res.status(404).json('comment does not exist');
        const commentIndex = post.comments.findIndex(comment => String(comment._id) === commentId);
        if (String(req.user) !== String(post.comments[commentIndex].author)) return res.status(403).json('forbidden');
        if (commentIndex < 0) {
            return res.status(404).json('comment does not exist');
        }
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
                    post.comments[commentIndex].media = post.comments[commentIndex].media.filter(oldMedia => oldMedia !== media);
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
                post.comments[commentIndex].media[post.comments[commentIndex].media.length] = "/media/" + file.filename
            });
        }
        if(content){
            post.comments[commentIndex].content = content;
            post.comments[commentIndex].updated_at = Date.now();
        }
        Post.updateOne({_id: mongoose.Types.ObjectId(id)}, {$set: {
                'comments.$[filter]': post.comments[commentIndex],
                'updated_at': post.comments[commentIndex].updated_at
            }}, {arrayFilters: [{'filter._id': mongoose.Types.ObjectId(commentId)}]}, function(err, value) {
            if(err) next(err);
            res.status(200).json(post.comments[commentIndex])
        })
    });

module.exports = commentController;