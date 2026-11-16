/* Root maintenance tool. Default is read-only. Never prints generated credentials. */
const { createRequire } = require('node:module');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const load = createRequire('/workspace/apps/api/package.json');
const { createDatabaseClient } = load('@nora/database');
const { hash } = load('argon2');
const db = createDatabaseClient();
const site = process.env.SITE_COMMERCE_SITE_CODE ?? 'nss';
if (!['nss', 'jahan-bastan'].includes(site)) throw Error('Unknown sales site');
const isJahan = site === 'jahan-bastan';
const username = isJahan ? 'jahan-bastan-site-sales' : 'nss-site-sales';
const displayName = isJahan ? 'سایت جهان باستان' : 'سایت نیایش';
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
  if (isJahan && (
    !branches.some((b) => b.id === branchId && b.code === 'JAHAN_BASTAN') ||
    !issuers.some((e) => e.id === legalEntityId && e.code === 'JAHAN_BASTAN')
  )) throw Error('Jahan Bastan requires its own branch and issuer');
  if (existing || permissions.length !== codes.length)
    throw Error(
      'Existing identity or missing permissions; no modification performed',
    );
  const roleCode = `${site}-site-commerce-v1`;
  if (await db.role.findUnique({ where: { code: roleCode } }))
    throw Error('Role already exists; do not overwrite');
  const output = `/tmp/${site}-site-client.env`;
  const password = randomBytes(40).toString('base64url') + 'aA1!';
  const passwordHash = await hash(password, {
    type: 2,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
  fs.writeFileSync(
    output,
    `ERP_COMMERCE_ENABLED=${!isJahan}\nERP_API_URL=https://avinaofficial.ir/api/v1\nERP_USERNAME=${username}\nERP_PASSWORD=${password}\nERP_SITE_CODE=${site}\n`,
    { mode: 0o600, flag: 'wx' },
  );
  try {
    const result = await db.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          code: roleCode,
          name: `اتصال فروش ${displayName}`,
          permissions: {
            create: permissions.map((p) => ({ permissionId: p.id })),
          },
        },
      });
      const user = await tx.user.create({
        data: {
          username,
          displayName,
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
          entityId: site,
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
