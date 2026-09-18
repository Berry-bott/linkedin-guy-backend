'use strict';

const { PrismaClient } = require('@prisma/client');
const env = require('./env');


const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__prisma ||
  new PrismaClient({
    log: env.isProduction ? ['error'] : ['warn', 'error'],
  });

if (!env.isProduction) {
  globalForPrisma.__prisma = prisma;
}

/** Verify connectivity at boot. */
async function connectDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[db] Connected to the database.');
  } catch (error) {
    console.error('[db] Unable to reach the database:', error.message);
    throw error;
  }
}

/** Close the pool so the process can exit cleanly. */
async function disconnectDatabase() {
  await prisma.$disconnect();
}

module.exports = { prisma, connectDatabase, disconnectDatabase };
