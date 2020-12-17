const loginController = require('express').Router();
const decryptPassword = require('../utils/decryptPassword');
const {OAuth2Client} = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const fetch = require('node-fetch');
const User = require("../models/user");
const generateToken = require('../utils/generateToken');

loginController.post('/',function (req,res,next) {
    const {email, phone, password} = req.body;
    if(!email && !phone){
        return res.status(400).json({error: 'must send email or phone'});
    }
    User.findOne({$and:[{email: email}, {phone: phone}]},(err, user) => {
        if(err) next(err);
        else if(user === null){
            return res.status(404).json({error: "this user does not exist"});
        }
        else if(!user.confirmed){
            return res.status(400).json({
                user_id: user._id,
                email: email,
                phone: phone,
                message: "please activate your account first"
            });
        }
        decryptPassword(password, user.password).then(match => {
            if(!match) return res.status(400).json({error: 'password is incorrect'});
            generateToken({name: user.name, email: user.email, userId: user._id, phone: user.phone}, (err, token) => {
                if(err) next(err);
                return res.status(200).json({
                    name: user.name,
                    email: user.email,
                    avatar: user.avatar,
                    phone: user.phone,
                    userId: user._id,
                    token: token
                })
            });
        }).catch(err => {
            return next(err);
        });

    })
});
loginController.post('/google', (req,res,next) => {
    const {tokenId} = req.body;
    if(!tokenId) return res.status(400).json('token id is a required field');
    googleClient.verifyIdToken({idToken: tokenId, audience: process.env.GOOGLE_CLIENT_ID}, (err, result) => {
        if(err) next(err);
        const {email, email_verified, name, picture} = result.payload;
        if(!email_verified) return res.status(400).json('please verify email from google side first');
        else{
            User.findOne({email: email}, (err, user) => {
                if(err) next(err);
                else if(!user) {
                    const newUser = new User({
                        name: name,
                        password: email + name,
                        email: email,
                        avatar: picture,
                        confirmed: true
                    });
                    newUser.save((err, user) => {
                        if (err && err.code === 11000)
                            return res
                                .status(409)
                                .json({ errors: "the email is already in used" });
                        if (err) return next(err);
                        generateToken({name: user.name, email: user.email, userId: user._id}, (err, token) => {
                            if(err) next(err);
                            return res.status(200).json({
                                name: user.name,
                                email: user.email,
                                avatar: user.avatar,
                                userId: user._id,
                                token: token
                            })
                        })
                    });

                }else{
                    generateToken({name: user.name, email: user.email, userId: user._id}, (err, token) => {
                        if(err) next(err);
                        return res.status(200).json({
                            name: user.name,
                            email: user.email,
                            avatar: user.avatar,
                            userId: user._id,
                            token: token
                        })
                    })
                }
            });
        }
    })
});
loginController.post('/facebook', (req,res,next) => {
    const {accessToken, userId} = req.body;
    if(!accessToken || !userId) return res.status(400).json('access token and user id are required fields');
    const graphURL  = `https://graph.facebook.com/v2.11/${userId}/?fields=id,name,phone,email,picture.type(large)&access_token=${accessToken}`;
    fetch(graphURL, {
        method: 'GET'
    }).then(res => res.json())
        .then(jsonRes => {
            const {name, email, picture} = jsonRes;
            User.findOne({email: email}, (err, user) => {
                if(err) next(err);
                else if(!user) {
                    const newUser = new User({
                        name: name,
                        password: email + name,
                        email: email,
                        avatar: picture.data.url,
                        confirmed: true
                    });
                    newUser.save((err, user) => {
                        if (err && err.code === 11000)
                            return res
                                .status(409)
                                .json({ errors: "the email is already in used" });
                        if (err) return next(err);
                        generateToken({name: user.name, email: user.email, userId: user._id}, (err, token) => {
                            if(err) next(err);
                            return res.status(200).json({
                                name: user.name,
                                email: user.email,
                                avatar: user.avatar,
                                userId: user._id,
                                token: token
                            })
                        })
                    });

                }else{
                    generateToken({name: user.name, email: user.email, userId: user._id}, (err, token) => {
                        if(err) next(err);
                        return res.status(200).json({
                            name: user.name,
                            email: user.email,
                            avatar: user.avatar,
                            userId: user._id,
                            token: token
                        })
                    })
                }
            });
        })
        .catch(e => next(e));

});

module.exports = loginController;