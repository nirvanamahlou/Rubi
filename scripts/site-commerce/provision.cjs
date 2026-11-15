/* Root maintenance tool. Default is read-only. Never prints generated credentials. */
const { createRequire } = require('node:module');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const load = createRequire('/workspace/apps/api/package.json');
const { createDatabaseClient } = load('@nora/database');
const { hash } = load('argon2');
const db = createDatabaseClient();
const username = 'nss-site-sales';
const codes = [
  'sales.contracts.create',
  'sales.contracts.read.own',
  'sales.contracts.confirm',
  'sales.reservation_request.create',
  'sales.payments.create',
  'sales.export',
];

async function main() {
  const branches = await db.branch.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
  });
  const issuers = await db.legalEntity.findMany({
    where: { isActive: true },
    select: { id: true, code: true, persianName: true },
  });
  const existing = await db.user.findUnique({
    where: { username },
    select: { id: true, username: true },
  });
  const permissions = await db.permission.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });
  if (!process.argv.includes('--provision')) {
    console.log(
      JSON.stringify({
        branches,
        issuers,
        existing,
        missingPermissions: codes.filter(
          (code) => !permissions.some((p) => p.code === code),
        ),
      }),
    );
    return;
  }
  if (process.env.SITE_COMMERCE_PROVISION !== '1')
    throw Error('Explicit provision switch required');
  const branchId = process.env.SITE_COMMERCE_BRANCH_ID,
    legalEntityId = process.env.SITE_COMMERCE_ISSUER_ID;
  if (
    !branches.some((b) => b.id === branchId) ||
    !issuers.some((e) => e.id === legalEntityId)
  )
    throw Error('Explicit active branch and issuer required');
  if (existing || permissions.length !== codes.length)
    throw Error(
      'Existing identity or missing permissions; no modification performed',
    );
  const roleCode = 'nss-site-commerce-v1';
  if (await db.role.findUnique({ where: { code: roleCode } }))
    throw Error('Role already exists; do not overwrite');
  const output = '/tmp/nss-site-client.env';
  const password = randomBytes(40).toString('base64url') + 'aA1!';
  const passwordHash = await hash(password, {
    type: 2,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
  fs.writeFileSync(
    output,
    `ERP_COMMERCE_ENABLED=true\nERP_API_URL=https://avinaofficial.ir/api/v1\nERP_USERNAME=${username}\nERP_PASSWORD=${password}\nERP_SITE_CODE=nss\n`,
    { mode: 0o600, flag: 'wx' },
  );
  try {
    const result = await db.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          code: roleCode,
          name: 'اتصال فروش سایت نیایش',
          permissions: {
            create: permissions.map((p) => ({ permissionId: p.id })),
          },
        },
      });
      const user = await tx.user.create({
        data: {
          username,
          displayName: 'سایت نیایش',
          passwordHash,
          roles: { create: [{ roleId: role.id }] },
          branches: { create: [{ branchId, isPrimary: true }] },
        },
        select: { id: true },
      });
      await tx.userLegalEntityContext.create({
        data: { userId: user.id, mode: 'SPECIFIC', legalEntityId },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: null,
          action: 'integrations.site.provisioned',
          entityType: 'website_connection',
          entityId: 'nss',
          outcome: 'SUCCESS',
          metadata: {
            userId: user.id,
            branchId,
            legalEntityId,
            provisioner: 'server-root',
            permissions: codes,
          },
        },
      });
      return { userId: user.id, branchId, legalEntityId };
    });
    console.log(JSON.stringify({ ...result, credentialFile: output }));
  } catch (error) {
    fs.unlinkSync(output);
    throw error;
  }
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
