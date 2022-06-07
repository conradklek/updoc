require('dotenv').config()
const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
//const chalk = require('chalk')
const mongoosePaginate = require('mongoose-paginate-v2')
const fs = require('fs')
const path = require('path')
const morgan = require('morgan')
const isTrue = require('node-env-flag')
const skrapiMiddleware = require('./lib/skrapi-middleware')
const utils = require('./lib/utils')

// Require an API_HOST and API_ROOT set in .env.
if (!process.env?.API_HOST || !process.env?.API_ROOT) {
  console.error('\nERROR: API_HOST and API_ROOT must be set in api/.env')
  process.exit()
}

// Set default limit for mongoosePaginate plugin.
const paginationLimit = 50

// Set up Express app.
const app = express()
app.use(cors())
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(morgan('dev')) // log requests and errors

// Disable cache during development.
if (process.env.DEV_MODE) app.disable('etag')

// Add Skrapi middleware.
app.use(skrapiMiddleware)

const apiRoot = '/' + utils.trimSlashes(process.env?.API_ROOT) || ''

let apiUrl = utils.trimSlashes(process.env?.API_HOST) || 'http://localhost'
// Add explicitly set port number?
if (process.env?.API_PORT && ![80, 443].includes(process.env?.API_PORT)) {
  apiUrl += `:${process.env.API_PORT}`
}
apiUrl += apiRoot // ex: http://localhost:3001/api/v1

// Add connection test route at API root.
app.get(apiRoot, (req, res) => {
  res.data({ message: 'API connection successful' })
})

// Dynamically add all routes found in routes/ dir excluding those prefixed with underscore.
dynamicallyLoadRoutes('./routes')

function dynamicallyLoadRoutes(dirPath) {
  files = fs.readdirSync(dirPath)
  files.forEach((fileName) => {
    const itemPath = dirPath + '/' + fileName
    if (fs.statSync(itemPath).isDirectory()) {
      // Recurse into directory.
      dynamicallyLoadRoutes(itemPath)
    } else {
      if (!fileName.startsWith('_') && fileName.endsWith('.js')) {
        const routePath = dirPath.replace(/^\.\/routes/, '')
        const routeName = fileName.slice(0, -3)
        const routeFile = dirPath + '/' + routeName
        const routeUri = path.join(apiRoot, routePath, routeName)
        app.use(routeUri, require(routeFile))
      }
    }
  })
}

// Ignore favicon requests.
app.get(apiRoot + '/favicon.ico', (req, res) => {
  res.status(204).end()
})

// Handle 404s (any non-error requests which weren't handled above).
// Note that Express does not consider 404s to be an "error" - just an unhandled route.
app.use(apiRoot, (req, res, next) => {
  res.error(404)
})

// Handle all errors including both natural and invoked with res.error(404))
app.use(apiRoot, (error, req, res, next) => {
  // Set up default response.
  const response = { status: error.status || 500, error: {} }

  // Edge case: Mongo returns a "CastError" when trying to find an id which isn't properly formed.
  // ...so `http://example.com/users/123` is a 500 Error because `123` isn't a real MongoId.
  // Those should actually be regular old 400 Bad Request errors.
  if (error && error.name == 'CastError') {
    response.status = 400
    response.error.detail = 'MongoDB CastError (malformed ObjectId)'
  }

  // Is this a MongoDB validation error?
  let validationErrors = []
  if (error.name == 'ValidationError') {
    response.status = 400
    for (let item in error.errors) {
      let validationErrorObj = {}
      validationErrorObj[item] = error.errors[item].message
      validationErrors.push(validationErrorObj)
    }
  }

  // Set error.message property
  const messages = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    413: 'Payload Too Large',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
    507: 'Insufficient Storage',
    509: 'Bandwidth Limit Exceeded',
  }

  response.error.message = messages[response.status] || 'Unspecified Error'

  // Add error.detail?
  if (response.error.detail) response.error.detail = response.error.detail

  // Add response.error.detail.validationErrors?
  if (validationErrors.length) {
    response.error.detail = response.error.detail || {}
    response.error.detail.validationErrors = validationErrors
  }
  if (process.env.DEV_MODE && response.status >= 500) console.error(error)
  res.status(response.status).json(response)
})

function start() {

  if (!process.env.DB_CONN) {
    //console.error(
    //  chalk.red('\n** Please set a MongoDB connection string in api/.env\n'),
    //)
    process.exit()
  }

  // Connect to Mongo
  mongoose.Promise = global.Promise
  mongoose.connect(process.env.DB_CONN, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  mongoose.connection.on('error', (err) => {
    console.log('err:', err)
    /*
    console.error(
      chalk.red(
        '\n\n---------------------------------------------------------------',
      ),
    )
    console.error(
      chalk.red(
        ' ** Unable to connect to MongoDB. Check DB_CONN in api/.env **',
      ),
    )
    console.error(
      chalk.red(
        '---------------------------------------------------------------',
      ),
    )
    */
    process.exit()
  })

  // Housekeeping: If the Node process ends, close the Mongoose connection.
  process.on('SIGINT', function () {
    mongoose.connection.close(() => {
      process.exit()
    })
  })

  // Set pagination default limit and make meta data return as a separate object.
  mongoosePaginate.paginate.options = {
    limit: paginationLimit,
    customLabels: {
      docs: 'data',
      meta: 'meta',
    },
  }

  // Start the server.
  const port = process.env.API_PORT || 3100
  app.listen(port)
  console.log(`\n👍 Skrapi API server listening at ${apiUrl}\n`)
}

start()
