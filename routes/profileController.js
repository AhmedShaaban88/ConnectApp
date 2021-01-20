const profileController = require("express").Router();
const upload = require('../config/avatarUploader');
const User = require("../models/user");
const Posts = require("../models/post");
const FriendShip = require('../models/friendship');
const cloudinary = require('cloudinary').v2;
const { body, validationResult } = require("express-validator");
const mongoose = require('mongoose');
const {ObjectId} = mongoose.Types;


profileController.put('/edit',async (req,res,next) =>{
        const {user} = req;
        const userInfo = await User.findById(ObjectId(user)).lean();
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
                    await User.updateOne({_id: ObjectId(user)}, {$set: {password: newProfile.password, ...newProfile}, $unset: {avatar: 1, avatarId: 1}});
                    return res.status(200).json({
                        userId: user,
                        name: newProfile.name,
                        avatar: null
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
           await User.updateOne({_id: ObjectId(user)},
                {$set: {password: newProfile.password, ...newProfile}});
            return res.status(200).json({
                userId: user,
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
    else if(!ObjectId.isValid(id)) return res.status(400).json('id is not valid');
    try{
        const user = await User.findById(ObjectId(id), {confirmed: 0, password:0, __v: 0, avatarId: 0, forgetCode: 0 , forgetCodeExpires: 0, friends: 0}).lean();
        if(!user) return res.status(404).json('user does not exist');
        else if(user.verifyCode) return res.status(400).json('user is inactive');
        const editable = String(req.user) === String(id);
        const friendStatus = !editable ? await FriendShip.findOne({$and: [{'requester': ObjectId(req.user)},{'recipient': ObjectId(id)}]}).lean() : null;
        res.status(200).json({...user._doc, editable: editable, status: friendStatus ? friendStatus.status : 0})
    }catch (e) {
        next(e);
    }
});

profileController.get('/view/:id/posts', (req,res,next)=>{
    let {limit, page} = req.query;
    const {id} = req.params;
    if(!id) return res.status(400).json('User id required');
    else if(!ObjectId.isValid(id)) return res.status(400).json('id is not valid');
    let currentPage = parseInt(page);
    let currentLimit = parseInt(limit);
    if(limit < 5 || !Boolean(currentLimit)) currentLimit =5;
    if(page < 1 || !Boolean(currentPage)) currentPage =1;
    Posts.paginate({author: ObjectId(id)}, {limit: currentLimit, page: currentPage, sort: {'updated_at': -1}, select: '-__v'}, (err, results)=>{
        if(err) next(err);
        res.status(200).json(results);
    });
});

module.exports = profileController;