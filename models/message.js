const {Schema, model} = require('mongoose');
const mediaSchema = require('./media');
const mongoosePaginate = require('mongoose-paginate');
const messageSchema = new Schema({
    sender: {type: Schema.Types.ObjectId, ref: 'User'},
    receiver: {type: Schema.Types.ObjectId, ref: 'User'},
    roomId: {type: Schema.Types.ObjectId, ref: 'Room'},
    seen: {type: Schema.Types.ObjectId, ref: 'User', default: null},
    content: {type: String, trim: true},
    media: [{type: mediaSchema}],
}, {timestamps: {createdAt: 'delivered_at'},collection: 'Messages'});
messageSchema.plugin(mongoosePaginate);

module.exports = model('Message', messageSchema);