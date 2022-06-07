/**
 * # lib/skrapi-middleware.js
 *
 * Adds helpful properties and methods to Express `req` and `res` objects.
 *
 * res.data(data, [meta], [token])
 * ------------------------------------------------------------------
 * Generates a 200 status JSON response formatted to skrapi standard. Automatically includes a token
 * if not explicitly passed and if a validated token is present.
 *
 * SPECIAL CASE: If the `data` arg is an error status code, res.data will instead call res.error.
 * This makes it possible to use this handy shortcut: `res.data(thing || 404);`
 *
 * res.error(status, [detail])
 * ------------------------------------------------------------------
 * Generates an error response with JSON formatted to skrapi standard. For common errors, a default
 * message is provided.
 */

const jwt = require('jsonwebtoken')
const { addMinutes, getUnixTime } = require('date-fns')
const utils = require('./utils')
const User = require('../models/User')

const tokenExpiration = [7, 0, 0] // [ days, hours, minutes ]
const tokenRefresh = [0, 0, 15]

module.exports = async (req, res, next) => {
  // Attach rawToken, validToken to req object if present.
  const { rawToken, validToken } = await getTokenProps(req, res, next)
  req.rawToken = rawToken
  req.validToken = validToken

  res.data = (data, meta, token) => {
    if (!data) throw 'Error: res.data() requires at least one valid argument'
    // Special case: Handle single arg error status code?
    if (typeof data == 'number' && data >= 400 && data < 600) {
      res.error(data)
      return
    }
    // Normal case: Handle regular data response.
    const response = { status: 200, data: utils.cleanData(data) }
    if (meta) response.meta = meta
    // Add explicitly passed token ?
    if (token) response.token = token
    // Or, is there a new (or refreshed) rawToken that should added to response?
    else if (req.rawToken) response.token = req.rawToken
    res.status(200).json(response)
  }

  res.error = (status, detail) => {
    if (!typeof status == 'number' || status < 400 || status > 599) {
      throw 'Error: res.error requires first argument to be an integer between 400 and 599.'
    }
    const error = new Error()
    error.status = status
    if (detail) error.detail = detail
    next(error) // Gets handled as general error in server.js
  }

  res.setToken = (obj) => {
    const newToken = generateNewToken(obj)
    if (newToken) {
      req.validToken = jwt.decode(newToken)
      req.rawToken = newToken
    }
  }

  next()
}

/* --------------------------------------------------- */

async function getTokenProps(req, res, next) {
  const tokenProps = { rawToken: null, validToken: null }

  // No token in request header? No problem.
  const authHeader = req.headers.authorization

  if (!authHeader) return tokenProps

  // Check if token is valid.
  try {
    tokenProps.rawToken = authHeader.replace(/^Bearer /, '') // Remove "Bearer "
    validToken = jwt.verify(tokenProps.rawToken, process.env.JWT_KEY)
  } catch (err) {
    if (err.message == 'invalid signature') {
      console.error('Invalid JWT signature.')
      console.error('You might try deleting `token` from your localStorage.\n')
    } else {
      console.error(err)
    }
    return tokenProps
  }

  if (!validToken) {
    console.error('JWT failed verification')
    return tokenProps
  }

  // Okay we have a valid token. Is it past due for a refresh?
  if (validToken.refresh < getUnixTime(new Date())) {
    // Check for legit user matching the _id for this token.
    const user = await User.findById(validToken.id).catch((err) =>
      console.error(err),
    )
    if (user) {
      // Create a new token with same _id, updated timestamps for `exp` and `refresh`, and current roles.
      const { _id, roles } = user
      const newToken = generateNewToken({ _id, roles })
      // Set the un-decoded token so it can be passed in JSON response.
      tokenProps.rawToken = newToken
      // ...and the decoded and validated token is available for reference.
      tokenProps.validToken = jwt.decode(newToken)
      return tokenProps
    }
  }

  // Not ready for refresh yet. So just pass a copy of the original token to the response.
  tokenProps.validToken = validToken
  return tokenProps
}

function generateNewToken(obj) {
  let newToken

  if (!obj._id) {
    console.error('Unable to create new token. Missing `_id` property')
    return
  }

  try {
    newToken = jwt.sign(
      {
        id: obj._id,
        roles: obj.roles,
        exp: obj.exp || getEpoch(tokenExpiration),
        refresh: obj.exp || getEpoch(tokenRefresh),
      },
      process.env.JWT_KEY,
    )
  } catch (err) {
    next(err)
  }

  return newToken
}

function getEpoch(array) {
  const [days, hours, minutes] = array
  const totalMinutes = days * 24 * 60 + hours * 60 + minutes
  const now = new Date()
  const later = addMinutes(now, totalMinutes)
  return getUnixTime(later)
}
