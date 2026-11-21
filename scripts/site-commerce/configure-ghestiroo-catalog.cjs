/* Bind an existing, explicitly selected Ticket Catalog target. Run inside the API container. */
const { createRequire } = require('node:module');
const load = createRequire('/workspace/apps/api/package.json');
const db = load('@nora/database').createDatabaseClient();
const siteCode = 'ghestiroo';

async function main() {
  const bindings = JSON.parse(process.env.SITE_COMMERCE_BINDINGS ?? '{}');
  const binding = bindings[siteCode];
  const targetId = process.env.GHESTIROO_AVINA_PRICE_TARGET_ID;
  const createTarget = process.argv.includes('--create-target');
  if (
    !binding?.userId ||
    !binding.branchId ||
    (!targetId && !createTarget) ||
    Object.entries(bindings).some(
      ([site, candidate]) =>
        site !== siteCode && candidate?.userId === binding.userId,
    )
  )
    throw Error(
      'A dedicated Ghestiroo binding and an explicit price target are required',
    );

  await db.$transaction(
    async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: binding.userId },
        select: {
          username: true,
          branches: {
            select: {
              branch: { select: { code: true, isActive: true, id: true } },
              isPrimary: true,
            },
          },
        },
      });
      if (
        user.username !== 'ghestiroo-site-sales' ||
        !user.branches.some(
          (m) =>
            m.isPrimary &&
            m.branch.code === 'HQ' &&
            m.branch.isActive &&
            m.branch.id === binding.branchId,
        )
      )
        throw Error('Unexpected Ghestiroo service user or inventory branch');
      let target = await tx.ticketSalePriceTarget.findFirst({
        where: {
          branchId: binding.branchId,
          ...(targetId ? { id: targetId } : { code: 'GHESTIROO' }),
        },
        select: { id: true, isActive: true },
      });
      const bound = await tx.websiteCatalogDelivery.findUnique({
        where: { siteCode },
        select: { branchId: true, salePriceTargetId: true },
      });
      if (!target && !targetId && createTarget && !bound?.salePriceTargetId) {
        target = await tx.ticketSalePriceTarget.create({
          data: {
            branchId: binding.branchId,
            code: 'GHESTIROO',
            name: 'قسطی رو',
            createdByUserId: binding.userId,
          },
          select: { id: true, isActive: true },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: null,
            action: 'integrations.site.price_target.provisioned',
            entityType: 'website_connection',
            entityId: siteCode,
            outcome: 'SUCCESS',
            metadata: {
              branchId: binding.branchId,
              salePriceTargetId: target.id,
            },
          },
        });
      }
      if (!target?.isActive || (bound && bound.branchId !== binding.branchId))
        throw Error('Choose a dedicated active Ghestiroo target in HQ');
      const other = await tx.websiteCatalogDelivery.findFirst({
        where: { siteCode: { not: siteCode }, salePriceTargetId: target.id },
        select: { siteCode: true },
      });
      if (other)
        throw Error('Choose a dedicated active Ghestiroo target in HQ');
      if (bound?.salePriceTargetId) {
        if (bound.salePriceTargetId !== target.id)
          throw Error('Ghestiroo already has a stable price target');
        return;
      }
      await tx.websiteCatalogDelivery.upsert({
        where: { siteCode },
        create: {
          siteCode,
          branchId: binding.branchId,
          salePriceTargetId: target.id,
        },
        update: { salePriceTargetId: target.id, revision: { increment: 1 } },
      });
    },
    { isolationLevel: 'Serializable' },
  );
  console.log('Ghestiroo flight catalogue target configured.');
}

main()
  .catch(() => {
    console.error(
      'Ghestiroo price target setup failed. Verify the dedicated HQ binding and target.',
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
