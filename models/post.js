const {Schema, model} = require('mongoose');
const commentSchema = require('./comment');
const postSchema = new Schema({
    author: {type: Schema.Types.ObjectId, ref: 'User'},
    content: {type: String, required: true},
    media: [String],
    likes: [{type: Schema.Types.ObjectId, ref: 'Post'}],
    comments: [commentSchema]
}, {timestamps: {createdAt: 'posted_at', updatedAt: 'updated_at'}, collection: 'Posts'});

module.exports = model('Post', postSchema);