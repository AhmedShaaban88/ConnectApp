const multer = require("multer");
const path = require("path");
const uid = require("uniqid");
const storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, path.join(__dirname, "../uploads/media"));
    },
    filename: function (req, file, cb) {
        const fileFormat = file.originalname.split(".");
        cb(null, Date.now() + uid() + "." + fileFormat[fileFormat.length - 1]);
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