'use strict';

const bcrypt = require('bcryptjs');

/** Cost factor for bcrypt. 12 is a good balance of security and latency. */
const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password.
 * @param {string} plainPassword
 * @returns {Promise<string>} bcrypt hash.
 */
function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compare a plaintext password against a stored hash.
 * @param {string} plainPassword
 * @param {string} hash
 * @returns {Promise<boolean>} `true` when they match.
 */
function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

module.exports = { hashPassword, comparePassword, SALT_ROUNDS };
