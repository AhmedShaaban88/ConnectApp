const {Schema, model} = require('mongoose');
const mediaSchema = require('./media');
const mongoosePaginate = require('mongoose-paginate');
const aggregatePaginate = require('mongoose-aggregate-paginate-v2');
const postSchema = new Schema({
    author: {type: Schema.Types.ObjectId, ref: 'User'},
    content: {type: String, required: true},
    media: [{type: mediaSchema}],
    likes: [{type: Schema.Types.ObjectId, ref: 'User'}],
    comments: [{type: Schema.Types.ObjectId, ref: 'Comment'}]
}, {timestamps: {createdAt: 'posted_at', updatedAt: 'updated_at'}, collection: 'Posts'});
postSchema.plugin(mongoosePaginate);
postSchema.plugin(aggregatePaginate);

module.exports = model('Post', postSchema);