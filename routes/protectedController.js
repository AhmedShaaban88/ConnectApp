const protectedController = require("express").Router();
const postController = require('./postController');
const likeController = require('./likeController');
const commentController = require('./commentController');
const friendShipController = require('./friendshipController');
const profileController = require('./profileController');
protectedController.use('/post', postController);
protectedController.use('/like', likeController);
protectedController.use('/comment', commentController);
protectedController.use('/friendship', friendShipController);
protectedController.use('/profile', profileController);



module.exports = protectedController;
