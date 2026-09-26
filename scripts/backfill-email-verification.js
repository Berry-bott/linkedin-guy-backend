/** One-time backfill for accounts created before email verification shipped.
 *
 * Usage:
 *   node scripts/backfill-email-verification.js           # preview affected rows
 *   node scripts/backfill-email-verification.js --apply   # run the UPDATE
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const shouldApply = process.argv.includes('--apply');

async function main() {
  if (!shouldApply) {
    const pending = await prisma.user.count({
      where: { emailVerifiedAt: null },
    });
    console.log(`Pending rows (dry run): ${pending}`);
    console.log('Re-run with --apply to backfill.');
    return;
  }

  const result = await prisma.$queryRaw`
    UPDATE "users"
    SET "emailVerifiedAt" = COALESCE("updatedAt", now())
    WHERE "emailVerifiedAt" IS NULL
    RETURNING id
  `;
  console.log(`Backfilled rows: ${result.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
