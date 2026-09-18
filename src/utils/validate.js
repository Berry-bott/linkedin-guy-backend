'use strict';

const { validationResult } = require('express-validator');
const ApiError = require('./ApiError');

/** Password policy reused by register and change-password validation. */
const passwordRule = (chain) =>
  chain
    .isLength({ min: 8, max: 72 })
    .withMessage('Password must be between 8 and 72 characters.')
    .matches(/[a-z]/)
    .withMessage('Password must contain a lowercase letter.')
    .matches(/[A-Z]/)
    .withMessage('Password must contain an uppercase letter.')
    .matches(/\d/)
    .withMessage('Password must contain a number.');

/**
 * Runs after a chain of express-validator rules and converts any failures into
 * a single 400 `ApiError` with field-level details.
 *
 * @type {import('express').RequestHandler}
 */
function validate(req, _res, next) {
  const result = validationResult(req);

  if (result.isEmpty()) return next();

  const errors = result.array().map((error) => ({
    field: error.path,
    message: error.msg,
  }));

  return next(
    ApiError.badRequest('Validation failed.', { errors, code: 'VALIDATION_ERROR' }),
  );
}

module.exports = { validate, passwordRule };