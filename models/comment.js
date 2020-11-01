const {Schema, model} = require('mongoose');
const mongoosePaginate = require('mongoose-paginate');

const commentSchema = new Schema({
    content: String,
    media: [String],
    author: {type: Schema.Types.ObjectId, ref: 'User'},
    post: {type: Schema.Types.ObjectId, ref: 'Post'}
} , {timestamps: {createdAt: 'commented_at', updatedAt: 'updated_at'}, collection: 'Comments'});
commentSchema.plugin(mongoosePaginate);
const comment = model('Comment', commentSchema);

module.exports = comment;