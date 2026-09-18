'use strict';

/**
 * Prints the stored password hash for a user, to confirm bcrypt is in use and
 * that plaintext passwords are never persisted.
 *
 * Usage: node scripts/check-hash.js <email>
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const BCRYPT_RE = /^\$2[aby]\$\d{2}\$/;

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/check-hash.js <email>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { email: true, name: true, password: true, createdAt: true },
  });

  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }

  const cost = user.password.match(/\$2[aby]\$(\d{2})\$/);

  console.log('email        :', user.email);
  console.log('name         :', user.name);
  console.log('createdAt    :', user.createdAt.toISOString());
  console.log('hash prefix  :', user.password.slice(0, 29));
  console.log('hash length  :', user.password.length);
  console.log('is bcrypt    :', BCRYPT_RE.test(user.password));
  console.log('bcrypt cost  :', cost ? cost[1] : 'n/a');
  console.log('stores plaintext:', !BCRYPT_RE.test(user.password));
}

main()
  .catch((error) => {
    console.error('Error:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
