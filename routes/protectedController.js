const protectedController = require("express").Router();
const dashboardController = require('./dashboardController');
const postController = require('./postController');
const likeController = require('./likeController');
const commentController = require('./commentController');
const friendShipController = require('./friendshipController');
const profileController = require('./profileController');
const notificationController = require('./notificationController');
const messagesController = require('./messagesController');
const messengerController = require('./messengerController');

protectedController.use('/dashboard', dashboardController);
protectedController.use('/post', postController);
protectedController.use('/like', likeController);
protectedController.use('/comment', commentController);
protectedController.use('/friendship', friendShipController);
protectedController.use('/profile', profileController);
protectedController.use('/notifications', notificationController);
protectedController.use('/messages', messagesController);
protectedController.use('/messenger', messengerController);



module.exports = protectedController;
