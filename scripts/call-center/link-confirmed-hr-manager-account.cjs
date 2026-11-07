// Explicit owner-confirmed identity only; never matches an account by display name.
const fs = require('node:fs');
const { createRequire } = require('node:module');
async function main() {
  const [mode, employeeId, username, operatorUsername, file] =
    process.argv.slice(2);
  if (
    !['plan', 'apply'].includes(mode) ||
    !employeeId ||
    !username ||
    !operatorUsername ||
    !file ||
    username === operatorUsername
  )
    throw Error(
      'Usage: plan|apply confirmed-employee-id confirmed-account operator private-plan',
    );
  const req = createRequire('/workspace/apps/api/package.json');
  const db = req('@nora/database').createDatabaseClient();
  const { IamService } = require('/workspace/apps/api/dist/iam/iam.service.js');
  const { HrService } = require('/workspace/apps/api/dist/hr/hr.service.js');
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
      include: { branches: true, hrEmployee: true },
    });
    const employee = await db.hrEmployee.findUnique({
      where: { id: employeeId },
    });
    if (
      operator?.status !== 'ACTIVE' ||
      target?.status !== 'ACTIVE' ||
      target.hrEmployee ||
      !employee ||
      employee.userId ||
      employee.status !== 'فعال' ||
      employee.deletedAt ||
      employee.grade !== 'مدیر'
    )
      throw Error(
        'Active unlinked manager and confirmed active account required',
      );
    const actor = {
      userId: operator.id,
      branchIds: operator.branches.map((b) => b.branchId),
      permissions: authenticatedPermissionCodes(operator.roles),
    };
    if (
      !actor.permissions.includes('hr.manage') ||
      !actor.branchIds.includes(employee.branchId) ||
      !target.branches.some((b) => b.branchId === employee.branchId)
    )
      throw Error('Native HR/branch authority missing');
    const plan = {
      employeeId,
      targetId: target.id,
      operatorId: operator.id,
      branchId: employee.branchId,
      version: employee.version,
      createdAt: Date.now(),
    };
    if (mode === 'plan') {
      fs.writeFileSync(file, JSON.stringify(plan), { mode: 0o600 });
      console.log('HR_ACCOUNT_LINK_PLAN_VERIFIED');
      return;
    }
    const before = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (
      Date.now() - before.createdAt > 900000 ||
      ['employeeId', 'targetId', 'operatorId', 'branchId', 'version'].some(
        (k) => before[k] !== plan[k],
      )
    )
      throw Error('Plan changed or expired');
    const database = { client: db };
    const iam = new IamService(database, undefined, undefined);
    const hr = new HrService(database, iam, undefined, undefined);
    await hr.updateEmployee(
      employeeId,
      { version: employee.version, userId: target.id },
      actor,
    );
    const verified = await db.hrEmployee.findUnique({
      where: { id: employeeId },
    });
    if (verified.userId !== target.id)
      throw Error('Native HR link verification failed');
    for (const key of Object.keys(employee).filter(
      (k) => !['userId', 'updatedAt', 'version'].includes(k),
    ))
      if (JSON.stringify(employee[key]) !== JSON.stringify(verified[key]))
        throw Error('Unrelated HR field changed: ' + key);
    console.log('NATIVE_HR_MANAGER_ACCOUNT_LINK_VERIFIED');
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
