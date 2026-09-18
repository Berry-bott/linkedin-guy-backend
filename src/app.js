'use strict';

const express = require('express');

const { corsMiddleware } = require('./config/cors');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

/**
 * Builds the Express application.
 *
 * Kept separate from the server bootstrap so it can be imported directly by
 * tests (e.g. supertest) without opening a port.
 *
 * @returns {import('express').Express}
 */
function createApp() {
  const app = express();

  // Behind a reverse proxy (Render, Railway, Vercel, nginx) this makes
  // `req.ip` and `req.protocol` reflect the real client.
  app.set('trust proxy', 1);

  // CORS must run before the routes so preflight requests are answered.
  app.use(corsMiddleware);

  // Body parsers — 100kb is plenty for JSON auth payloads.
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  app.get('/', (_req, res) => {
    res.status(200).json({
      success: true,
      message: 'LinkedIn backend API',
      docs: '/api/health',
    });
  });

  app.use('/api', routes);

  // 404 then the central error handler — order matters.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
