const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const { isArray, isObject } = require('lodash')
require('dotenv').config()

module.exports = {
  getModelNames() {
    // Return an array of names for each model found in models/ dir.
    const modelNames = []
    const modelsDir = path.normalize(__dirname + '/../models')
    const files = fs.readdirSync(modelsDir)
    files.forEach((filename) => {
      // const itemPath = modelsDir + '/' + filename;
      if (!filename.startsWith('_') && filename.endsWith('.js')) {
        const model = require(path.join(modelsDir, filename))
        // const collectionName = model.collection.collectionName;
        modelNames.push(model.modelName)
      }
    })
    return modelNames.sort()
  },

  trimSlashes(str) {
    // Remove leading and trailing slashes (leave inner ones).
    return str.replace(/^\/|\/$/g, '')
  },

  // Convert full model instance to plain object and recursively strip all Mongoose `__v` props.
  cleanData(data) {
    return cleanArrayOrObject(data)

    function cleanArrayOrObject(data) {
      data = data instanceof mongoose.Model ? data.toObject() : data

      if (isArray(data)) return cleanArray(data)
      if (isNonBufferObject(data)) return cleanObject(data)
      return data
    }

    function cleanArray(array) {
      return array.map(cleanArrayOrObject)
    }

    function cleanObject(object) {
      Object.keys(object).forEach((key) => {
        if (key == '__v') delete object['__v']
        else object[key] = cleanArrayOrObject(object[key])
      })
      return object
    }

    function isNonBufferObject(data) {
      return isObject(data) && !Buffer.isBuffer(data)
    }
  },

  sanitize(body, modelOrArray) {
    let allowedKeys
    // Sanitize to allowedKeys explicitly specified in array?
    if (isArray(modelOrArray)) {
      allowedKeys = modelOrArray
    }
    // Sanitize to allowedKeys present in Mongoose schema?
    else if (modelOrArray?.schema instanceof mongoose.Schema) {
      // Return the req.body object with only props whose keys are present in the model.schema.
      const schemaPaths = Object.getOwnPropertyNames(modelOrArray.schema.paths)
      // Reduce paths like contractorInfo.rate and contractorInfo.status to just contratorInfo.
      const schemaKeys = schemaPaths.map((key) => {
        return key.indexOf('.') ? key.split('.')[0] : key
      })
      const metaKeys = ['_id', 'createdAt', 'updatedAt', '__v']
      allowedKeys = schemaKeys.filter((key) => !metaKeys.includes(key))
    } else {
      throw '\nError: utils.function requires a Mongoose model object or an array of allowed keys.\n'
    }

    const sanitizedBody = {}
    Object.keys(body).forEach((key) => {
      // console.log('key', key)
      // console.log('allowedKeys', allowedKeys)
      if (allowedKeys.includes(key)) sanitizedBody[key] = body[key]
    })
    return sanitizedBody
  },
}
