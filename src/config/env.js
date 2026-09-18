'use strict';

/**
 * Loads environment variables from `.env` (if present) and validates the ones
 * the application cannot run without. Fails fast at boot so misconfiguration is
 * obvious instead of surfacing as a confusing runtime error.
 */

const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { NODE_ENV = 'development' } = process.env;

/** Parse a comma-separated env var into a trimmed, non-empty array. */
function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const env = {
  nodeEnv: NODE_ENV,
  isProduction: NODE_ENV === 'production',
  port: Number.parseInt(process.env.PORT || '5000', 10),

  databaseUrl: process.env.DATABASE_URL,
  directUrl: process.env.DIRECT_URL,

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  corsOrigins: parseList(process.env.CORS_ORIGIN),
  corsAllowVercelPreviews: process.env.CORS_ALLOW_VERCEL_PREVIEWS === 'true',
};

/** Variables that must be present for the app to function. */
const required = ['databaseUrl', 'jwtSecret'];
const missing = required.filter((key) => !env[key]);

if (missing.length > 0) {
  const names = missing.map((key) => key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase());
  throw new Error(
    `Missing required environment variable(s): ${names.join(', ')}.\n` +
      'Copy .env.example to .env and fill in the values.',
  );
}

if (env.isProduction && env.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long in production.');
}

if (env.corsOrigins.length === 0) {
  // Sensible default so local development works out of the box.
  env.corsOrigins = ['http://localhost:3000'];
}

module.exports = env;
