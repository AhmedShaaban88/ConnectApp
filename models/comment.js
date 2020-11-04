const {Schema, model} = require('mongoose');
const mediaSchema = require('./media');
const mongoosePaginate = require('mongoose-paginate');

const commentSchema = new Schema({
    content: String,
    media: [{type: mediaSchema}],
    author: {type: Schema.Types.ObjectId, ref: 'User'},
    post: {type: Schema.Types.ObjectId, ref: 'Post'}
} , {timestamps: {createdAt: 'commented_at', updatedAt: 'updated_at'}, collection: 'Comments'});
commentSchema.plugin(mongoosePaginate);
const comment = model('Comment', commentSchema);

module.exports = comment;