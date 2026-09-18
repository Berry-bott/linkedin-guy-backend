'use strict';


const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  if (!process.argv.includes('--yes')) {
    console.error('This deletes every user. Re-run with --yes to confirm.');
    process.exit(1);
  }

  const before = await prisma.user.count();
  const { count } = await prisma.user.deleteMany();
  console.log(`Deleted ${count} of ${before} user(s).`);
}

main()
  .catch((error) => {
    console.error('Error:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());