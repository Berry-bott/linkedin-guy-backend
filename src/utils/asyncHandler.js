'use strict';

/**
 * Wraps an async route handler so rejected promises are forwarded to Express'
 * error middleware.
 *
 * Express 5 already forwards rejections automatically; wrapping keeps the
 * behaviour explicit and identical if the code is ever run on Express 4.
 *
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => any} handler
 * @returns {import('express').RequestHandler}
 */
function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
