const {Schema} = require('mongoose');
const commentSchema = new Schema({
    content: String,
    media: [String],
    author: {type: Schema.Types.ObjectId, ref: 'User'}
} , {timestamps: {createdAt: 'commented_at', updatedAt: 'updated_at'}});

module.exports = commentSchema;