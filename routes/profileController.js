const profileController = require("express").Router();
const upload = require('../config/avatarUploader');
const User = require("../models/user");
const { body, validationResult } = require("express-validator");
const mongoose = require('mongoose');

profileController.put('/edit',
    upload.single("avatar"),
    [
        body("name").isLength({ min: 3 }).withMessage("name at least 3 chars"),
        body("password")
            .isLength({ min: 8 })
            .withMessage("password at least 8 chars"),
    ]
    ,async (req,res,next)=>{
        const { password, name } = req.body;
        const {user} = req;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res
                .status(400)
                .json({ errors: errors.array().map((err) => err.msg) });
        }

        const newProfile = {
            name: name,
            password: password
        };
        if (req.file){
            newProfile.avatar = "/avatar/" + req.file.filename;
        }
        try{
            await User.updateOne({_id: mongoose.Types.ObjectId(user)},
                {$set: {password: newProfile.password, newProfile}});
            return res.status(200).json({
                _id: user,
                name: newProfile.name,
                avatar: newProfile.avatar
            })

        }catch (e) {
            next(e)
        }


});

module.exports = profileController;