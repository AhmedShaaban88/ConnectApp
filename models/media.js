const {Schema} = require('mongoose');
const mediaSchema = new Schema({
   path: String,
   title: String
});

module.exports = mediaSchema;