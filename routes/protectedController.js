const protectedController = require("express").Router();
const postController = require('./postController');
const likeController = require('./likeController');
const commentController = require('./commentController');
protectedController.use('/post', postController);
protectedController.use('/like', likeController);
protectedController.use('/comment', commentController);



module.exports = protectedController;
