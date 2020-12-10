const {Schema, model} = require('mongoose');
const mongoosePaginate = require('mongoose-paginate');
const roomSchema = new Schema({
    participants: [{type: Schema.Types.ObjectId, ref: 'User'}],
    lastMessage: {type: Schema.Types.ObjectId, ref:'Message', default: null},
}, {collection: 'Rooms', timestamps: true});
roomSchema.plugin(mongoosePaginate);

module.exports = model('Room', roomSchema);