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
/*
User.aggregate([
  { "$lookup": {
    "from": Friend.collection.name,
    "let": { "friends": "$friends" },
    "pipeline": [
      { "$match": {
        "recipient": mongoose.Types.ObjectId("5afaab572c4ec049aeb0bcba"),
        "$expr": { "$in": [ "$_id", "$$friends" ] }
      }},
      { "$project": { "status": 1 } }
    ],
    "as": "friends"
  }},
  { "$addFields": {
    "friendsStatus": {
      "$ifNull": [ { "$min": "$friends.status" }, 0 ]
    }
  }}
])
 */