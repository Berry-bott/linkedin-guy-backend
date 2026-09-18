'use strict';

/**
 * Lists all users in the database (never prints password hashes).
 *
 * Usage: node scripts/list-users.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  const total = await prisma.user.count();

  console.log(`\n${total} user(s) in the database:\n`);
  for (const user of users) {
    console.log(`  ${user.id}  ${user.email}  (${user.name ?? 'no name'})  ${user.createdAt.toISOString()}`);
  }
  console.log();
}

main()
  .catch((error) => {
    console.error('Error:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());