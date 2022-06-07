require('dotenv').config()
const router = require('express').Router({ mergeParams: true })
const { nanoid } = require('nanoid')
const User = require('../models/User')
const UserAuth = require('../models/UserAuth')
const { sanitize } = require('../lib/utils')
const { isOwner } = require('../lib/auth')

// GET /users (w/pagination)
router.get('/', async (req, res, next) => {
  const page = req.query?.page || 1
  const limit = req.query?.results || 20
  const { data, meta } = await User.paginate({}, { page, limit }).catch(err => next(err))
  res.data(data, meta)
})

// POST /users
router.post('/', async (req, res, next) => {
  // Make sure email doesn't already exist.
  const userWithThisEmail = await User.findOne({ email: req.body.email })
  if (userWithThisEmail)
    return res.error(400, null, 'User with this email address already exists')

  const userWithThisName = await User.findOne({ name: req.body.name })
  if (userWithThisName)
    return res.error(400, null, 'User with this name already exists')

  // Store UserAuth separately (see models/UserAuth.js for more info).
  const tempKey = nanoid()
  const userAuthObj = { tempKey, password: req.body.password }
  const userAuth = await UserAuth.create(userAuthObj).catch((err) => next(err))
  if (!userAuth) return res.error(500, 'Failed to create userAuth')

  // Create new User.
  const sanitizedBody = sanitize(req.body, [
    'name',
    'email'
  ])
  const user = await User.create({
    ...sanitizedBody,
    auth: userAuth._id,
    path: [req.body.name],
    data: [{
      kind: "file",
      name: "Page 01.md",
      path: [req.body.name, "Page 01"],
      data: "# He's a joker!",
    }, {
      kind: "file",
      name: "Page 02.md",
      path: [req.body.name, "Page 02.md"],
      data: "## He's a smoker!",
    }, {
      kind: "file",
      name: "Page 03.md",
      path: [req.body.name, "Page 03.md"],
      data: "### He's a midnight toker!",
    }, {
      kind: "file",
      name: "readme.md",
      path: [req.body.name, "readme.md"],
      data: "# Hello, world!",
    }, {
      kind: "file",
      name: "index.html",
      path: [req.body.name, "index.html"],
      data: "<h1>Hello, world!</h1>",
    }, {
      kind: "directory",
      name: "styles",
      path: [req.body.name, "styles"],
      data: [{
        kind: "file",
        name: "main.css",
        path: [req.body.name, "styles", "main.css"],
        data: "body { color: red; }",
      }]
    }, {
      kind: "directory",
      name: "scripts",
      path: [req.body.name, "scripts"],
      data: [{
        kind: "file",
        name: "main.js",
        path: [req.body.name, "scripts", "main.js"],
        data: "console.log('Hello, world!');",
      }]
    }]
  }).catch((err) => next(err))
  if (!user) return res.error(500, 'Failed to create new user')

  // Create validation link.
  const apiUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`
  const validationLink = `${apiUrl}/${user._id}/getTokenWithKey/${tempKey}`

  // Log the validationLink for now. Code could go here to send email (for example, with Mailgun)
  console.log('\nValidation Link')
  console.log(
    '-----------------------------------------------------------------------------',
  )
  console.log(validationLink)
  console.log(
    '-----------------------------------------------------------------------------\n',
  )

  res.data(user)
})

// POST /users/login
router.post('/login', async (req, res, next) => {
  // Load user for this email address.
  const user = await User.findOne({ email: req.body.email }).catch((err) => next(err))
  // Validate the password.
  const isValidUser = user && await user.validatePassword(req.body.password)
  if (isValidUser) {
    // Set token and return user.
    const { _id, roles } = user
    res.setToken({ _id, roles })
    return res.data(user)
  }
  return res.error(401)
})

// GET /users/<name>
router.get('/:name', async (req, res, next) => {
  const user = await User.findOne({ name: req.params.name }).catch((err) => next(err))
  if (!user) return res.error(404)
  res.data(user.data)
})

// PATCH /users/<id>
router.patch('/:id', isOwner, async (req, res, next) => {
  // Populate update object only with allowed keys present in req.body.
  const sanitizedBody = sanitize(req.body, ['name', 'email', 'data'])
  const user = await User.findByIdAndUpdate(req.params.id, sanitizedBody, { new: true }).catch(
    err => next(err)
  )
  res.data(user || 404)
})

// DELETE /users/<id>
router.delete('/:id', isOwner, async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id, req.body).catch(err => next(err))
  res.data(user || 404)
})

module.exports = router