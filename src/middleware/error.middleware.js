'use strict';

const env = require('../config/env');
const ApiError = require('../utils/ApiError');

/** 404 handler for unmatched routes — runs after all routers. */
function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} does not exist.`));
}

/**
 * Maps Prisma error codes onto HTTP responses.
 * @see https://www.prisma.io/docs/orm/reference/error-reference
 */
function normaliseError(error) {
  if (error instanceof ApiError) return error;

  if (error.code === 'P2002') {
    const target = error.meta?.target;
    const field = Array.isArray(target) ? target.join(', ') : target || 'field';
    return ApiError.conflict(`A record with this ${field} already exists.`, {
      code: 'DUPLICATE_RECORD',
    });
  }

  if (error.code === 'P2025') {
    return ApiError.notFound('The requested record was not found.', {
      code: 'RECORD_NOT_FOUND',
    });
  }

  if (error.code === 'P1001' || error.code === 'P1017') {
    return new ApiError(503, 'Database is unavailable. Please try again shortly.', {
      code: 'DATABASE_UNAVAILABLE',
    });
  }

  // Thrown by the CORS origin callback above.
  if (error.message && error.message.includes('not allowed by CORS')) {
    return ApiError.forbidden(error.message, { code: 'CORS_ORIGIN_DENIED' });
  }

  return error;
}

/** Central error handler — must be registered last and keep 4 arguments. */
// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, _next) {
  const normalised = normaliseError(error);
  const statusCode = normalised.statusCode || 500;

  if (statusCode >= 500) {
    console.error('[error]', req.method, req.originalUrl, '\n', error);
  }

  const body = {
    success: false,
    message: statusCode >= 500 && !normalised.isOperational
      ? 'Internal server error'
      : normalised.message,
  };

  if (normalised.code) body.code = normalised.code;
  if (normalised.errors) body.errors = normalised.errors;
  if (!env.isProduction && statusCode >= 500) body.stack = error.stack;

  res.status(statusCode).json(body);
}

module.exports = { notFoundHandler, errorHandler };