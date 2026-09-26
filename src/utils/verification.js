'use strict';

const crypto = require('crypto');
const env = require('../config/env');

/** Length of the emailed verification code, in digits. */
const CODE_LENGTH = 6;

/**
 * Generate a cryptographically random numeric code (e.g. `483920`).
 * `randomInt` is unbiased, unlike `Math.random()` modulo tricks.
 *
 * @returns {string} zero-padded digit string of length {@link CODE_LENGTH}.
 */
function generateVerificationCode() {
  const max = 10 ** CODE_LENGTH;
  return crypto.randomInt(0, max).toString().padStart(CODE_LENGTH, '0');
}

/**
 * Hash a verification code for storage.
 *
 * The raw code never touches the database; only this hash is persisted, so a
 * database leak cannot be replayed to verify an account. Keyed with HMAC using
 * `JWT_SECRET` so hashes cannot be precomputed from the small 6-digit space.
 *
 * @param {string} code
 * @returns {string} hex-encoded HMAC-SHA256 digest.
 */
function hashVerificationCode(code) {
  return crypto.createHmac('sha256', env.jwtSecret).update(String(code)).digest('hex');
}

/** Constant-time comparison of a candidate hash against the stored hash. */
function verificationCodeMatches(candidateCode, storedHash) {
  if (!storedHash) return false;
  const candidateHash = Buffer.from(hashVerificationCode(candidateCode), 'hex');
  const expectedHash = Buffer.from(storedHash, 'hex');
  if (candidateHash.length !== expectedHash.length) return false;
  return crypto.timingSafeEqual(candidateHash, expectedHash);
}

/** Absolute expiry timestamp for a freshly issued code. */
function verificationCodeExpiry(from = new Date()) {
  return new Date(from.getTime() + env.emailVerificationCodeTtlMinutes * 60 * 1000);
}

module.exports = {
  CODE_LENGTH,
  generateVerificationCode,
  hashVerificationCode,
  verificationCodeMatches,
  verificationCodeExpiry,
};
