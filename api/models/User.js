const mongoose = require('mongoose')
const mongoosePaginate = require('mongoose-paginate-v2')
const validator = require('validator') // https://www.npmjs.com/package/validator
const bcrypt = require('bcrypt')
const UserAuth = require('./UserAuth')
const ObjectId = mongoose.Schema.Types.ObjectId
/* ------------------------------------------------------- */

modelName = 'User'

const schema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    kind: {
      type: String,
      default: "directory"
    },
    path: {
      type: Array,
      default: []
    },
    data: {
      type: Array,
      default: []
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      validate: [validator.isEmail, 'Invalid email']
    },
    roles: {
      type: Array,
      default: []
    },
    auth: {
      type: ObjectId,
      ref: 'UserAuth'
    }
  },
  { timestamps: true }
)

/* ------------------------------------------------------- */

schema.methods = {
  // .validateAndRemoveKey(tempKey)
  validateAndRemoveKey: async function (tempKey) {
    // Load up the UserAuth model
    const userAuth = await UserAuth.findById(this.auth).catch(err => {
      console.error(err)
    })
    if (!(tempKey && userAuth)) return false
    // Compare tempKey to hashed tempKey in db.
    const isValid = await bcrypt.compare(tempKey, userAuth.tempKey)

    if (isValid) {
      // Remove the tempKey so that checkAuthWithPassword is allowed.
      this.tempKey = ''
      await this.save()
    }

    return Boolean(isValid)
  },

  // .validatePassword(password)
  validatePassword: async function (password) {
    // Load up the UserAuth model
    const userAuth = await UserAuth.findById(this.auth).catch(err => {
      console.error(err)
    })
    if (!(password && userAuth)) return false
    // Compare password to hashed password in db.
    const isValid = await bcrypt.compare(password, userAuth.password)
    return Boolean(isValid)
  },
}

/* ------------------------------------------------------- */
schema.set('toObject', { virtuals: true })
schema.plugin(mongoosePaginate)
module.exports = mongoose.model(modelName, schema)
