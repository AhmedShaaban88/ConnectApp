const {Schema, model} = require('mongoose');
const mongoosePaginate = require('mongoose-paginate');

const friendship = Schema({
    requester: {type: Schema.Types.ObjectId, ref: 'User'},
    recipient: {type: Schema.Types.ObjectId, ref: 'User'},
    status: {type: Number, enum: [0,1,2,3]},
}, {collection: 'FriendShip'});
friendship.plugin(mongoosePaginate);

const friendShip = model('FriendShip', friendship);
module.exports = friendShip;