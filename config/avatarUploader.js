const multer = require("multer");
const path = require("path");
const uid = require("uniqid");
const storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, path.join(__dirname, "../uploads/avatar"));
    },
    filename: function (req, file, cb) {
        const fileFormat = file.originalname.split(".");
        cb(null, Date.now() + uid() + "." + fileFormat[fileFormat.length - 1]);
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