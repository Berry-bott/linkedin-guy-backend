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

  // SMTP delivery for email-verification messages (nodemailer).
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number.parseInt(process.env.SMTP_PORT || '587', 10),
  // Force IPv4 (4) by default. Hosts without IPv6 routing (e.g. Render) resolve
  // smtp.gmail.com to a Google IPv6 address and fail with ENETUNREACH.
  // Set SMTP_FAMILY=6 (or 0 for "let the OS decide") to override.
  smtpFamily: Number.parseInt(process.env.SMTP_FAMILY || '4', 10),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  smtpFrom: process.env.SMTP_FROM || 'chuks-kitchen <no-reply@example.com>',
  appUrl: process.env.APP_URL || 'http://localhost:5000',
  emailVerificationCodeTtlMinutes: Number.parseInt(
    process.env.EMAIL_VERIFICATION_TTL_MINUTES || '15',
    10,
  ),
  emailVerificationMaxAttempts: Number.parseInt(
    process.env.EMAIL_VERIFICATION_MAX_ATTEMPTS || '5',
    10,
  ),
  emailLogVerificationCode:
    process.env.EMAIL_LOG_VERIFICATION_CODE === 'true' && NODE_ENV !== 'production',

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

// In production a missing SMTP configuration would silently break registration
// (users could never verify), so fail fast instead.
if (env.isProduction && !env.smtpHost) {
  throw new Error(
    'Missing required environment variable: SMTP_HOST.\n' +
      'Email verification requires SMTP in production. Copy .env.example to .env and fill in the values.',
  );
}

if (env.corsOrigins.length === 0) {
  // Sensible default so local development works out of the box.
  env.corsOrigins = ['http://localhost:3000'];
}

module.exports = env;



 



