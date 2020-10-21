const fs = require('fs');
const readFileContent = function(path, callback) {
fs.readFile(path, {encoding: "utf8"}, function (err, html) {
        if (err) {
            if(err.code === 'ENOENT'){
                return new Error('file does not exists')
            }
            throw err;
        }
        else {
            callback(null, html);
        }
    });
};

module.exports = readFileContent;