// Operator-only native IAM repair. Never infer authorization from a job title.
const fs = require('node:fs');
const { createRequire } = require('node:module');
function matchUnit(employee, units) {
  if (
    employee?.status !== 'فعال' ||
    employee.deletedAt ||
    employee.grade !== 'مدیر'
  )
    throw Error('Active HR manager required');
  const matches = units.filter(
    (u) => u.branchId === employee.branchId && u.name === employee.unit,
  );
  if (matches.length !== 1) throw Error('Ambiguous or missing native unit');
  return matches[0];
}
module.exports = { matchUnit };
async function main() {
  const [mode, username, operatorUsername, file] = process.argv.slice(2);
  if (
    !['plan', 'apply'].includes(mode) ||
    !username ||
    !operatorUsername ||
    !file ||
    username === operatorUsername
  )
    throw Error('Usage: plan|apply target operator private-plan.json');
  const req = createRequire('/workspace/apps/api/package.json');
  const db = req('@nora/database').createDatabaseClient();
  const { IamService } = require('/workspace/apps/api/dist/iam/iam.service.js');
  const {
    HrUserUnitDirectory,
  } = require('/workspace/apps/api/dist/hr/hr-user-unit-directory.js');
  const {
    userDetailsRevision,
  } = require('/workspace/apps/api/dist/iam/user-details.js');
  const {
    authenticatedPermissionCodes,
  } = require('/workspace/apps/api/dist/iam/authenticated-permissions.js');
  const {
    manualUserInclude,
  } = require('/workspace/apps/api/dist/iam/manual-user-access.service.js');
  try {
    const operator = await db.user.findUnique({
      where: { username: operatorUsername },
      include: manualUserInclude,
    });
    const target = await db.user.findUnique({
      where: { username },
      include: { profile: true, hrEmployee: true, branches: true },
    });
    if (
      operator?.status !== 'ACTIVE' ||
      target?.status !== 'ACTIVE' ||
      target.profile?.organizationUnitId
    )
      throw Error('Active accounts and missing unit required');
    const actor = {
      userId: operator.id,
      branchIds: operator.branches.map((b) => b.branchId),
      permissions: authenticatedPermissionCodes(operator.roles),
    };
    const directory = new HrUserUnitDirectory({ client: db });
    const unit = matchUnit(target.hrEmployee, await directory.list(actor));
    if (!target.branches.some((b) => b.branchId === unit.branchId))
      throw Error('Target branch mismatch');
    const revision = userDetailsRevision(target);
    const plan = {
      targetId: target.id,
      operatorId: operator.id,
      unitId: unit.id,
      revision,
      displayName: target.displayName,
      createdAt: Date.now(),
    };
    if (mode === 'plan') {
      fs.writeFileSync(file, JSON.stringify(plan), { mode: 0o600 });
      console.log('MANAGER_UNIT_PLAN_VERIFIED');
      return;
    }
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (
      Date.now() - saved.createdAt > 900000 ||
      ['targetId', 'operatorId', 'unitId', 'revision', 'displayName'].some(
        (k) => saved[k] !== plan[k],
      )
    )
      throw Error('Plan changed or expired');
    const service = new IamService(
      { client: db },
      undefined,
      undefined,
      directory,
    );
    const result = await service.updateUserDetails(
      target.id,
      {
        displayName: target.displayName,
        revision,
        organizationUnitId: unit.id,
      },
      actor,
    );
    if (
      result.organizationUnitId !== unit.id ||
      result.displayName !== target.displayName
    )
      throw Error('Unit repair verification failed');
    console.log('MANAGER_UNIT_LINK_VERIFIED');
  } finally {
    await db.$disconnect();
  }
}
if (require.main === module)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
