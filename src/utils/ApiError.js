'use strict';

class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status code.
   * @param {string} message    Human-readable message.
   * @param {object} [options]
   * @param {Array<{field: string, message: string}>} [options.errors] Validation details.
   * @param {string} [options.code] Machine-readable error code.
   */
  constructor(statusCode, message, { errors, code } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, options) {
    return new ApiError(400, message, options);
  }

  static unauthorized(message = 'Unauthorized', options) {
    return new ApiError(401, message, options);
  }

  static forbidden(message = 'Forbidden', options) {
    return new ApiError(403, message, options);
  }

  static notFound(message = 'Resource not found', options) {
    return new ApiError(404, message, options);
  }

  static conflict(message, options) {
    return new ApiError(409, message, options);
  }

  static internal(message = 'Internal server error', options) {
    return new ApiError(500, message, options);
  }
}

module.exports = ApiError;
