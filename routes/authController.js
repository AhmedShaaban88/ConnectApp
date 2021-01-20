const authController = require("express").Router();
const { body, validationResult } = require("express-validator");
const User = require("../models/user");
const mongoose = require('mongoose');
const generateToken = require('../utils/generateToken');
const upload = require('../config/avatarUploader');
const sendVerificationEmail = require('../config/verificationEmail');
const sendVerificationMobile = require('../config/verificationMobile');
const cloudinary = require('cloudinary').v2;
const {ObjectId} = mongoose.Types;

const loginController = require('./loginController');
authController.post(
  "/register",
  upload.single("avatar"),
  [
    body("phone")
      .optional({ nullable: true })
      .isMobilePhone("ar-EG")
      .withMessage("only egypt numbers are allowed"),
    body("email")
      .optional({ nullable: true })
      .isEmail()
      .withMessage("Email is invalid"),
    body("name").isLength({ min: 3 }).withMessage("name at least 3 chars"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("password at least 8 chars"),
  ],
  function (req, res, next) {
    const { email, phone, password, name } = req.body;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if(req.file){
        return cloudinary.uploader.destroy(req.file.filename).then(r => res
            .status(400)
            .json({ errors: errors.array().map((err) => err.msg) })).catch(e => next(e));
      }
      return res.status(400)
          .json({ errors: errors.array().map((err) => err.msg) });

    } else if (!email && !phone) {
      return res.status(400).json({ errors: "no phone or email provided" });
    }
    const newUser = new User({
      name: name,
      password: password,
      verifyCode: Math.floor(100000 + Math.random() * 900000),
      verifyCodeExpires: Date.now() + 1800000,
    });
    if (phone) {
      newUser.phone = phone;
    }
    else if (email) {
      newUser.email = email;
    }
    if (req.file){
      newUser.avatar = req.file.path;
      newUser.avatarId = req.file.filename;
    }
    newUser.save((err, obj) => {
      if (err && err.code === 11000)
        return res
          .status(409)
          .json({ errors: "the email or phone is already in used" });
      if (err) return next(err);
      if(newUser.email){
        sendVerificationEmail(email, obj.verifyCode).then(response => {
          return res.status(200).json({
            message: "Please Verify Your Account",
            user_id: obj._id,
            email: obj.email
          });
        }).catch(e => {
          next(e)
        });
      }else{
        sendVerificationMobile(phone, obj.verifyCode, (err, _res) => {
          if(err) next(err);
          return res.status(200).json({
            message: "Please Verify Your Account",
            user_id: obj._id,
            phone: obj.phone
          });
        })
      }
    });
  }
);

authController.post('/verify-account', function (req, res, next) {
  const {code, userId} = req.body;
  User.findById(ObjectId(userId)).lean().exec((err, user) => {
    if(err) next(err);
    else if(user === null){
      return res.status(404).json({error: "this user does not exist"})
    }
   else if(Date.now() < user.verifyCodeExpires && code !== user.verifyCode){
     return res.status(400).json({error: "the code is not valid"});
          }
   else if(Date.now() > user.verifyCodeExpires){
          return res.status(400).json({error: "the code is expired"});
    }
    else if (user.confirmed === true) {
      return res.status(400).json({error: "this user is already activated"});
    }
    generateToken({name: user.name, email: user.email, userId: user._id, phone: user.phone}, (err, token) => {
      if(err) next(err);
      User.updateOne({_id: ObjectId(userId)}, {$set: {confirmed: true}
        ,$unset: {verifyCode: "", verifyCodeExpires: ""}}, (err, currentUser) => {
        return res.status(200).json({
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          phone: user.phone,
          userId: user._id,
          token: token
        })
      });
    });

  })
});
authController.post('/resend-verification-email', function (req, res, next) {
  const {email} = req.body;
  User.findOne({email: email}).lean().exec((err, user) => {
    if(err) next(err);
    else if(user === null){
      return res.status(404).json({error: "this user does not exist"});
    }
    else if(user.confirmed === true){
      return res.status(400).json({error: "this user is already activated"});
    }
    const verifiedInfo = {
      verifyCode: Math.floor(100000 + Math.random() * 900000),
      verifyCodeExpires: Date.now() + 1800000
    };
    User.updateOne({email: email},
        {$set: {verifyCode: verifiedInfo.verifyCode, verifyCodeExpires: verifiedInfo.verifyCodeExpires}},
        (err, currentUser) => {
      if(err) next(err);
      sendVerificationEmail(email, verifiedInfo.verifyCode).then(response => {
        return res.status(200).json({message: "A verification code has been sent to your email"})
      }).catch(e => {
        next(e)
      });
    }).catch(e => {
      next(e)
    });
  })
});
authController.post('/resend-verification-mobile', function (req, res, next) {
  const {phone} = req.body;
  User.findOne({phone: phone}).lean().exec((err, user) => {
    if (err) next(err);
    else if (user === null) {
      return res.status(404).json({error: "this user does not exist"});
    } else if (user.confirmed === true) {
      return res.status(400).json({error: "this user is already activated"});
    }
    const verifiedInfo = {
      verifyCode: Math.floor(100000 + Math.random() * 900000),
      verifyCodeExpires: Date.now() + 1800000
    };
    User.updateOne({phone: phone}, {
      $set: {
        verifyCode: verifiedInfo.verifyCode,
        verifyCodeExpires: verifiedInfo.verifyCodeExpires
      }
    }, (err, currentUser) => {
      if (err) next(err);
      sendVerificationMobile(phone, verifiedInfo.verifyCode, (err, _res) => {
        if (err) next(err);
        return res.status(200).json({message: "A verification code has been sent to your phone"})
      })
    }).catch(e => {
      next(e)
    });
  })
});

authController.post('/forget-password', function (req,res,next) {
  const {email, phone} = req.body;
  if(!email && !phone){
    return res.status(400).json({error: 'must send email or phone'});
  }
  User.findOne({$and:[{email: email}, {phone: phone}]}).lean().exec((err, user) => {
    if(err) next(err);
    else if(user === null){
      return res.status(404).json({error: "this user does not exist"});
    }
    const verifiedInfo = {
      forgetCode: Math.floor(100000 + Math.random() * 900000),
      forgetCodeExpires: Date.now() + 1800000
    };
    User.updateOne({$and: [{email: email},{ phone: phone}]}, {$set: {forgetCode: verifiedInfo.forgetCode, forgetCodeExpires: verifiedInfo.forgetCodeExpires}}, (err, currentUser) => {
      if(err) next(err);
      else if(email){
        sendVerificationEmail(email, verifiedInfo.forgetCode).then(response => {
          return res.status(200).json({message: "A verification code has been sent to your email"})
        }).catch(e => {
          next(e)
        });
      }else{
        sendVerificationMobile(phone, verifiedInfo.forgetCode, (err, _res) => {
          if (err) next(err);
          return res.status(200).json({message: "A verification code has been sent to your phone"})
        })
      }
    }).catch(e => {
      next(e)
    });
  })
});
authController.post('/reset-password',[
    body('password').isLength({ min: 8 })
        .withMessage("password at least 8 chars").custom((value, {req})=>{
          if(value !== req.body.confirmPassword){
            throw new Error('Password confirmation is incorrect');
          }else{
            return true;
          }
    }),
] ,function (req,res,next) {
  const {email, phone, password, code} = req.body;
  if(!email && !phone){
    return res.status(400).json({error: 'must send email or phone'});
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res
        .status(400)
        .json({ errors: errors.array().map((err) => err.msg) });
  }else{
    User.findOne({$and: [{email: email}, {phone: phone}]}).lean().exec((err, user) => {
      if(err) next(err);
      else if(user === null){
        return res.status(404).json({error: "this user does not exist"});
      }
      else if(Date.now() < user.forgetCodeExpires && code !== user.forgetCode){
        return res.status(400).json({error: "the code is not valid"});
      }
      else if(Date.now() > user.forgetCodeExpires){
        return res.status(400).json({error: "the code is expired"});
      }
      User.updateOne({$and: [{email: email}, {phone: phone}]}, {$set: {password: password},$unset: {forgetCode: "", forgetCodeExpires: ""}}, (err, currentUser) => {
        return res.status(200).json('reset password successfully')
      });
    });
  }
});
authController.use('/login', loginController);
module.exports = authController;
