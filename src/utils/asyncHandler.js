// Wraps async controllers so thrown errors reach the central error handler.
// Express 4 does not catch errors inside async functions by itself.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
