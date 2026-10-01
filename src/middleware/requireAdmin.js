const AppError = require('../utils/AppError');

// RBAC: only admins pass. Must run after authenticate.
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return next(new AppError('Admin access required.', 403));
  }
  next();
};

module.exports = requireAdmin;
