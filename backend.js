'use strict';

const env = require('./src/config/env');
const createApp = require('./src/app');
const { connectDatabase, disconnectDatabase } = require('./src/config/prisma');

/**
 * Server bootstrap.
 *
 * The HTTP server starts first so the process is reachable (and health checks
 * pass) even if the database is briefly unavailable; database connectivity is
 * then verified and reported.
 */

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`[server] Listening on http://localhost:${env.port} (${env.nodeEnv})`);
  console.log(`[cors] Allowed origins: ${env.corsOrigins.join(', ')}`);
  if (env.corsAllowVercelPreviews) console.log('[cors] *.vercel.app previews: allowed');
});

connectDatabase().catch(() => {
  console.error('[db] Starting without a verified database connection.');
});

/** Close connections cleanly on SIGINT/SIGTERM (Ctrl+C, container stop). */
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[server] ${signal} received — shutting down...`);

  server.close(async () => {
    try {
      await disconnectDatabase();
    } catch (error) {
      console.error('[db] Error while disconnecting:', error.message);
    }
    console.log('[server] Shutdown complete.');
    process.exit(0);
  });

  // Force-exit if graceful shutdown hangs.
  setTimeout(() => process.exit(1), 10000).unref();
}

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => shutdown(signal));
});

process.on('unhandledRejection', (reason) => {
  console.error('[process] Unhandled rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[process] Uncaught exception:', error);
  shutdown('uncaughtException');
});

module.exports = server;

