/* Run inside the Rubi API container after deploying the stage-two migration. */
const { createRequire } = require('node:module');
const { randomBytes } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const load = createRequire('/workspace/apps/api/package.json');
const db = load('@nora/database').createDatabaseClient();
const siteCode = 'jahan-bastan';

async function main() {
  const bindings = JSON.parse(process.env.SITE_COMMERCE_BINDINGS ?? '{}');
  const binding = bindings[siteCode];
  if (
    !binding?.userId ||
    !binding.branchId ||
    binding.userId === bindings.nss?.userId
  )
    throw Error('A dedicated Jahan Bastan binding is required');

  await db.$transaction(
    async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: binding.userId },
        select: {
          username: true,
          branches: { select: { branch: true, isPrimary: true } },
        },
      });
      const hasBranch = (code, primary) =>
        user.branches.some(
          (m) =>
            m.branch.code === code &&
            m.branch.isActive &&
            m.isPrimary === primary &&
            (!primary || m.branch.id === binding.branchId),
        );
      if (
        user.username !== 'jahan-bastan-site-sales' ||
        !hasBranch('HQ', true) ||
        !hasBranch('JAHAN_BASTAN', false)
      )
        throw Error('Unexpected Jahan Bastan user or branches');
      const current = await tx.websiteCatalogDelivery.findUnique({
        where: { siteCode },
      });
      const targets = await tx.ticketSalePriceTarget.findMany({
        where: {
          branchId: binding.branchId,
          isActive: true,
          ...(current?.salePriceTargetId
            ? { id: current.salePriceTargetId }
            : { name: 'سایت جهان باستان' }),
        },
        select: { id: true },
        take: 2,
      });
      if (
        targets.length !== 1 ||
        (current && current.branchId !== binding.branchId)
      )
        throw Error('A unique active Jahan Bastan target in HQ is required');
      if (current?.salePriceTargetId) return;
      await tx.websiteCatalogDelivery.upsert({
        where: { siteCode },
        create: {
          siteCode,
          branchId: binding.branchId,
          salePriceTargetId: targets[0].id,
        },
        update: {
          salePriceTargetId: targets[0].id,
          revision: { increment: 1 },
        },
      });
    },
    { isolationLevel: 'Serializable' },
  );

  // Exclusive creation makes an existing key safe across provisioning retries.
  if (process.argv.includes('--create-key')) {
    writeFileSync(
      '/root/jahan-bastan-catalog.env',
      'JAHAN_BASTAN_CATALOG_WEBHOOK_SECRET=' +
        randomBytes(48).toString('hex') +
        '\n',
      { flag: 'wx', mode: 0o600 },
    );
  }
  console.log('Jahan Bastan catalog target configured.');
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
