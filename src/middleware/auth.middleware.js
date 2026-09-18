'use strict';

const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../utils/token');
const { prisma } = require('../config/prisma');
const { PUBLIC_FIELDS } = require('../services/auth.service');

/**
 * Requires a valid `Authorization: Bearer <token>` header.
 * On success attaches the authenticated user to `req.user`.
 *
 * @type {import('express').RequestHandler}
 */
async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';

    if (!header.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Authentication token is missing.', {
        code: 'TOKEN_MISSING',
      });
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw ApiError.unauthorized('Authentication token is missing.', {
        code: 'TOKEN_MISSING',
      });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch (error) {
      const expired = error.name === 'TokenExpiredError';
      throw ApiError.unauthorized(
        expired ? 'Authentication token has expired.' : 'Authentication token is invalid.',
        { code: expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID' },
      );
    }

    // Tokens are stateless, so re-read the user to catch deleted accounts and
    // to guarantee an up-to-date record. Uses the same column list as the auth
    // service so new fields cannot drift out of sync.
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: PUBLIC_FIELDS,
    });

    if (!user) {
      throw ApiError.unauthorized('Account no longer exists.', { code: 'USER_NOT_FOUND' });
    }

    req.user = user;
    req.token = token;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { requireAuth };