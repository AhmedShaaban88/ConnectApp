const multer = require("multer");
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('./cloudinaryConfig');
const path = require("path");

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'avatar',
    },
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 500000 },
    fileFilter: function (req, file, cb) {
        let filetypes = /jpeg|jpg|png/;
        let mimetype = filetypes.test(file.mimetype);
        let extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb({name : "MulterError", message : "Unsupported image type only jpg, jpeg, png"}, false);
    },
});

module.exports = upload;