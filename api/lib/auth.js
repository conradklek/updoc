module.exports = {
  isOwner(req, res, next) {
    if (!checkIsOwner(req)) return res.error(401)
    next()
  },

  isAdmin(req, res, next) {
    if (!checkIsAdmin(req)) return res.error(401)
    next()
  },

  isOwnerOrAdmin(req, res, next) {
    if (!checkIsOwner(req) && !checkIsAdmin(req)) return res.error(401)
    next()
  }
}

function checkIsOwner(req) {
  return Boolean(req.validToken?.id && req.validToken.id === req.params?.id)
}

function checkIsAdmin(req) {
  return Boolean(req.validToken?.roles && req.validToken.roles?.includes('admin'))
}
