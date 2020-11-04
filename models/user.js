const { Schema, model } = require("mongoose");
const encryptPassword = require('../utils/encryptPassword');
const mongoosePaginate = require('mongoose-paginate');
const userSchema = new Schema(
  {
    name: { type: String, trim: true, required: true },
    email: String,
    phone: String,
    password: { type: String, minLength: 8, required: true },
    avatar: String,
    avatarId: String,
    confirmed: { type: Boolean, default: false },
    verifyCode: Number,
    verifyCodeExpires: Date,
    forgetCode: Number,
    forgetCodeExpires: Date,
    friends: [{type: Schema.Types.ObjectId, ref: 'FriendShip'}]
  },
  { collection: "User", runValidators: true }
);
userSchema.plugin(mongoosePaginate);
userSchema.pre("save", function (next) {
  let user = this;
  if (!user.isModified("password")) return next();
  if (user.password) {
      encryptPassword(user.password)
          .then(hash => {
              user.password = hash;
              next();
          })
          .catch(err => next(err));
  }
});
userSchema.pre('updateOne', function(next) {
    const modifiedField = this.getUpdate().$set.password;
    const user = this;
    if (!modifiedField) {
        return next();
    }
    encryptPassword(modifiedField)
        .then(hash => {
            user._update.$set.password = hash;
            next();
        })
        .catch(err => next(err));
});
module.exports = model("User", userSchema);
