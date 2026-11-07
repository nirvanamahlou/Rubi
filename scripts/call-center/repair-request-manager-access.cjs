// Run inside the existing API container; plan is read-only, apply uses the public IAM service.
const fs = require('node:fs');
const { createRequire } = require('node:module');
const TEAM = 'customer_affairs.call_center.workflow.manage.team';
function assertOnlyTeamGrant(before, after) {
  for (const key of ['screenIds', 'allowedControlIds'])
    if (
      JSON.stringify([...before[key]].sort()) !==
      JSON.stringify([...after[key]].sort())
    )
      throw Error('Unrelated selection change: ' + key);
  const added = after.permissionCodes.filter(
    (c) => !before.permissionCodes.includes(c),
  );
  const removed = before.permissionCodes.filter(
    (c) => !after.permissionCodes.includes(c),
  );
  if (removed.length || added.some((c) => c !== TEAM))
    throw Error('Unrelated permission change');
  if (!after.permissionCodes.includes(TEAM)) throw Error('Missing team grant');
}
module.exports = { assertOnlyTeamGrant, TEAM };

async function main() {
  const [mode, username, operatorUsername, file] = process.argv.slice(2);
  if (
    !['plan', 'apply'].includes(mode) ||
    !username ||
    !operatorUsername ||
    !file
  )
    throw Error('Usage: plan|apply account operator private-plan.json');
  if (username === operatorUsername)
    throw Error('Self authorization is not supported');
  const req = createRequire('/workspace/apps/api/package.json');
  const db = req('@nora/database').createDatabaseClient();
  const contracts = req('@nora/contracts');
  const {
    ManualUserAccessService,
    manualUserInclude,
  } = require('/workspace/apps/api/dist/iam/manual-user-access.service.js');
  const {
    authenticatedPermissionCodes,
  } = require('/workspace/apps/api/dist/iam/authenticated-permissions.js');
  const {
    IamCallCenterDirectory,
  } = require('/workspace/apps/api/dist/iam/iam-call-center-directory.js');
  const service = new ManualUserAccessService({ client: db });
  try {
    const target = await db.user.findUnique({
      where: { username },
      include: { ...manualUserInclude, profile: true, hrEmployee: true },
    });
    const operator = await db.user.findUnique({
      where: { username: operatorUsername },
      include: manualUserInclude,
    });
    if (
      !target ||
      !operator ||
      target.status !== 'ACTIVE' ||
      operator.status !== 'ACTIVE'
    )
      throw Error('Active native accounts required');
    const authority = authenticatedPermissionCodes(operator.roles);
    if (!authority.includes('iam.users.manage') || !authority.includes(TEAM))
      throw Error('Operator cannot delegate team assignment');
    const unit =
      target.profile?.organizationUnitId &&
      (await db.hrRecord.findFirst({
        where: {
          id: target.profile.organizationUnitId,
          section: 'organization',
          tab: 'units',
          status: 'فعال',
          deletedAt: null,
        },
      }));
    if (
      !unit ||
      target.hrEmployee?.deletedAt ||
      target.hrEmployee?.status !== 'فعال' ||
      target.hrEmployee?.branchId !== unit.branchId
    )
      throw Error('Native active employee/unit alignment required');
    if (
      !target.branches.some((b) => b.branchId === unit.branchId) ||
      !operator.branches.some((b) => b.branchId === unit.branchId)
    )
      throw Error('Branch authority missing');
    const before = await service.read(target.id);
    if (!before.alreadyManual)
      throw Error('This repair only supports existing manual snapshots');
    const after = contracts.completeManualAccessPrerequisites(
      {
        ...before.selection,
        permissionCodes: [
          ...new Set([...before.selection.permissionCodes, TEAM]),
        ],
      },
      before.selection,
    );
    if (
      contracts.mustScopeCallCenter(before.selection, after) &&
      !after.permissionCodes.includes(contracts.CALL_CENTER_SCOPED_ACCESS)
    )
      throw Error('Separate scope migration required; repair refused');
    assertOnlyTeamGrant(before.selection, after);
    const actor = {
      userId: target.id,
      branchIds: target.branches.map((b) => b.branchId),
      permissions: authenticatedPermissionCodes(target.roles),
    };
    const directory = new IamCallCenterDirectory({ client: db });
    const current = await directory.requestAssignees(actor, unit.branchId);
    const candidate = await directory.requestAssignees(
      { ...actor, permissions: [...new Set([...actor.permissions, TEAM])] },
      unit.branchId,
    );
    if (candidate.length < 1 || !candidate.some((x) => x.id === target.id))
      throw Error('Team acceptance failed');
    const rows = await db.user.findMany({
      where: { id: { in: candidate.map((x) => x.id) } },
      select: { profile: true },
    });
    if (rows.some((r) => r.profile?.organizationUnitId !== unit.id))
      throw Error('Cross-unit candidate');
    const plan = {
      username,
      operatorUsername,
      targetId: target.id,
      unitId: unit.id,
      branchId: unit.branchId,
      revision: before.revision,
      before: before.selection,
      after,
      title: before.title,
      currentCount: current.length,
      expectedCount: candidate.length,
      expectedIds: candidate.map((x) => x.id).sort(),
      createdAt: Date.now(),
    };
    if (mode === 'plan') {
      fs.writeFileSync(file, JSON.stringify(plan, null, 2), { mode: 0o600 });
      console.log(
        JSON.stringify({
          currentCount: current.length,
          expectedCount: candidate.length,
          added: before.selection.permissionCodes.includes(TEAM) ? [] : [TEAM],
        }),
      );
      return;
    }
    const approved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (
      approved.targetId !== target.id ||
      approved.unitId !== unit.id ||
      approved.branchId !== unit.branchId ||
      approved.operatorUsername !== operatorUsername ||
      approved.revision !== before.revision ||
      Date.now() - approved.createdAt > 900000 ||
      JSON.stringify(approved.after) !== JSON.stringify(after)
    )
      throw Error('Plan changed or expired');
    await service.save(
      target.id,
      { revision: before.revision, title: before.title, ...after },
      {
        userId: operator.id,
        branchIds: operator.branches.map((b) => b.branchId),
        permissions: authority,
      },
    );
    const verified = await service.read(target.id);
    assertOnlyTeamGrant(before.selection, verified.selection);
    const refreshed = await db.user.findUnique({
      where: { id: target.id },
      include: manualUserInclude,
    });
    const verifiedUsers = await directory.requestAssignees(
      { ...actor, permissions: authenticatedPermissionCodes(refreshed.roles) },
      unit.branchId,
    );
    const count = verifiedUsers.length;
    if (
      count !== approved.expectedCount ||
      JSON.stringify(verifiedUsers.map((x) => x.id).sort()) !==
        JSON.stringify(approved.expectedIds)
    )
      throw Error('Post-save acceptance changed');
    fs.writeFileSync(
      file + '.verified.json',
      JSON.stringify(
        {
          appliedAt: new Date().toISOString(),
          expectedCount: count,
          exactDelta: TEAM,
          auditedByIam: true,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    console.log('REQUEST_MANAGER_ACCESS_VERIFIED count=' + count);
  } finally {
    await db.$disconnect();
  }
}
if (require.main === module)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
