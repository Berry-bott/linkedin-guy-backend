'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Sign an access token for a user.
 *
 * @param {{ id: string, email: string }} user
 * @returns {string} Signed JWT.
 */
function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

/**
 * Verify a token and return its payload.
 *
 * @param {string} token
 * @returns {{ sub: string, email: string, iat: number, exp: number }}
 * @throws {Error} If the token is invalid or expired.
 */
function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

module.exports = { signToken, verifyToken };