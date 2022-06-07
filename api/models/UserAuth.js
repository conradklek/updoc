const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const validator = require('validator'); // https://www.npmjs.com/package/validator
const bcrypt = require('bcrypt');
/* ------------------------------------------------------- */

modelName = 'UserAuth';

// Use a separate Schema (and mongo collection) for authSchema because most of the time `user`
// should not contain auth properties. Instead, call `user.populate('auth')` when needed.
const schema = new mongoose.Schema(
  {
    tempKey: {
      // tempKey is created for new user for email validation.
      type: String
    },
    password: {
      type: String,
      minlength: 6,
      required: true
    }
  },
  { timestamps: true }
);

/* ------------------------------------------------------- */

// On save(), hash the password and tempKey if new or modified.
schema.pre('save', async function (next) {
  // Hash the password if new or modified.
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  // Hash the tempKey if it exists AND is new or modified.
  if (this.tempKey && this.isModified('tempKey')) {
    this.tempKey = await bcrypt.hash(this.tempKey, 10);
  }
  next();
});

/* ------------------------------------------------------- */
schema.plugin(mongoosePaginate);
module.exports = mongoose.model(modelName, schema);
