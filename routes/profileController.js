const profileController = require("express").Router();
const upload = require('../config/avatarUploader');
const User = require("../models/user");
const Posts = require("../models/post");
const FriendShip = require('../models/friendship');
const cloudinary = require('cloudinary').v2;

const { body, validationResult } = require("express-validator");
const mongoose = require('mongoose');

profileController.put('/edit',async (req,res,next) =>{
        const {user} = req;
        const userInfo = await User.findById(mongoose.Types.ObjectId(user));
        req.userInfo = userInfo;
        if(!userInfo) return res.status(404).json('user does not exist');
        else next();
    },
    upload.single("avatar"),
    [
        body("name").isLength({ min: 3 }).withMessage("name at least 3 chars"),
        body("password")
            .isLength({ min: 8 })
            .withMessage("password at least 8 chars"),
        body("deleteAvatar").optional({nullable: true}).isBoolean().withMessage("deleteAvatar must be boolean"),
    ]
    ,async (req,res,next)=>{
        const { password, name, deleteAvatar } = req.body;
        const {user, userInfo} = req;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            if(req.file){
                return cloudinary.uploader.destroy(req.file.filename).then(r => res
                    .status(400)
                    .json({ errors: errors.array().map((err) => err.msg) })).catch(e => next(e));
            }
            return res.status(400)
                .json({ errors: errors.array().map((err) => err.msg) });
        }

        const newProfile = {
            name: name,
            password: password
        };
        if(deleteAvatar && !req.file){
                try{
                    await cloudinary.uploader.destroy(userInfo.avatarId);
                    await User.updateOne({_id: mongoose.Types.ObjectId(user)}, {$set: {password: newProfile.password, ...newProfile}, $unset: {avatar: 1, avatarId: 1}});
                    return res.status(200).json({
                        _id: user,
                        name: newProfile.name,
                        avatar: newProfile.avatar
                    })
                }
                catch (e) {
                    next(e);
                }
        }
        if (req.file){
            if(userInfo.avatar){
                try{
                    await cloudinary.uploader.destroy(userInfo.avatarId);
                }
                catch (e) {
                    next(e);
                }
            }
            newProfile.avatar = req.file.path;
            newProfile.avatarId = req.file.filename;
        }
        try{
           await User.updateOne({_id: mongoose.Types.ObjectId(user)},
                {$set: {password: newProfile.password, ...newProfile}});
            return res.status(200).json({
                _id: user,
                name: newProfile.name,
                avatar: newProfile.avatar
            })

        }catch (e) {
            next(e)
        }


});
profileController.get('/view/:id', async (req,res,next)=>{
    const {id} = req.params;
    if(!id) return res.status(400).json('User id required');
    try{
        const user = await User.findById(mongoose.Types.ObjectId(id), {confirmed: 0, password:0, __v: 0, avatarId: 0}).populate({
            path: 'friends',
            match: {$and: [{status: {$eq: 3}}, {requester: mongoose.Types.ObjectId(id)}]},
            select: '-requester -__v -status',
            perDocumentLimit: 5,
            populate: {
                path: 'recipient',
                select: '-password -confirmed -friends -__v -avatarId',
            }
        });
        const friendStatus = await FriendShip.findOne({$and: [{'requester': mongoose.Types.ObjectId(req.user)},{'recipient': mongoose.Types.ObjectId(id)}]});
        res.status(200).json({user, status: friendStatus ? friendStatus.status : 0})
    }catch (e) {
        next(e);
    }


});
profileController.get('/view/:id/posts', (req,res,next)=>{
    let {limit, page} = req.query;
    const {id} = req.params;
    if(!id) return res.status(400).json('User id required');
    let currentPage = parseInt(page);
    let currentLimit = parseInt(limit);
    if(limit < 5) currentLimit =5;
    if(page < 1) currentPage =1;
    Posts.paginate({author: mongoose.Types.ObjectId(id)}, {limit: currentLimit, page: currentPage, sort: {'updated_at': -1}, select: '-__v'}, (err, results)=>{
        if(err) next(err);
        res.status(200).json(results);
    });
});

module.exports = profileController;