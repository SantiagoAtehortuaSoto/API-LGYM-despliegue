const { auth, isAdmin } = require('./auth');

const isAdminReferer = (referer = '') => /\/admin(\/|$)/i.test(String(referer));

const conditionalAuth = (req, res, next) => {
  const referer = req.headers?.referer || '';

  // Middleware legacy: solo fuerza auth+admin cuando detecta contexto admin por referer.
  if (!isAdminReferer(referer)) {
    return next();
  }

  return auth(req, res, (err) => {
    if (err) {
      return next(err);
    }
    return isAdmin(req, res, next);
  });
};

module.exports = conditionalAuth;
