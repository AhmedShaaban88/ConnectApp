const multer = require("multer");
const path = require("path");
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('./cloudinaryConfig');
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'media',
        resource_type: "auto"
    },
});
const mediaUploader = multer({
    storage: storage,
    limits: { fileSize: 4000000 },
    fileFilter: function (req, file, cb) {
        let filetypes = /jpeg|jpg|png|mp4|avi|mov|wmv/;
        let mimetype = filetypes.test(file.mimetype);
        let extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb({name : "MulterError", message : "Unsupported media type only jpeg,jpg,png,mp4,avi,mov,wmv"}, false);
    },
});

module.exports = mediaUploader;