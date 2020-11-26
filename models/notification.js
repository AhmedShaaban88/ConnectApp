const {Schema, model} = require('mongoose');
const mongoosePaginate = require('mongoose-paginate');

const notificationsSchema = new Schema({
    seen: {type: Schema.Types.Boolean, default: false},
    receiver: {type: Schema.Types.ObjectId, ref: 'User'},
    by: {type: Schema.Types.ObjectId, ref: 'User'},
    post: {type: Schema.Types.ObjectId, ref: 'Post'},
    type: {type: Schema.Types.String, enum: ['comment', 'like', 'friend']},
    expires: {type: Date, default: () => new Date(+new Date() + 7*24*60*60*1000)}
} , {timestamps: {createdAt: 'notified_at'}, collection: 'Notifications'});
notificationsSchema.plugin(mongoosePaginate);
const notification = model('Notifications', notificationsSchema);

module.exports = notification;