'use strict';

const { Router } = require('express');

const authRoutes = require('./auth.routes');

const router = Router();

/** GET /api/health — lightweight liveness probe (no DB access). */
router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRoutes);

module.exports = router;
