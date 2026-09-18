'use strict';

const cors = require('cors');
const env = require('./env');

/**
 * CORS configuration.
 *
 * Allowed origins come from the `CORS_ORIGIN` env var (comma separated). When
 * `CORS_ALLOW_VERCEL_PREVIEWS=true`, any Vercel preview deployment for the
 * project is allowed as well, which keeps branch/PR previews working without
 * editing the env var on every deploy.
 *
 * Requests without an `Origin` header (curl, server-to-server, mobile apps,
 * health probes) are always allowed — CORS only governs browsers.
 */

/** Matches the production site and any preview deployment on *.vercel.app. */
function isAllowedVercelPreview(origin) {
  try {
    const { hostname, protocol } = new URL(origin);
    return protocol === 'https:' && hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (env.corsOrigins.includes(origin)) return true;

  if (
    !env.isProduction &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  ) {
    return true;
  }

  if (env.corsAllowVercelPreviews && isAllowedVercelPreview(origin)) return true;

  return false;
}

const corsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(
      new Error(`Origin "${origin}" is not allowed by CORS.`),
    );
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length'],
  maxAge: 86400, // cache preflight responses for 24h
  optionsSuccessStatus: 204,
};

module.exports = { corsMiddleware: cors(corsOptions), isOriginAllowed, corsOptions };