const fs = require('node:fs');
const { createRequire } = require('node:module');
const req = createRequire('/workspace/apps/api/package.json');
const {
  authenticatedPermissionCodes,
} = require('/workspace/apps/api/dist/iam/authenticated-permissions.js');
const {
  IamCallCenterDirectory,
} = require('/workspace/apps/api/dist/iam/iam-call-center-directory.js');
const db = req('@nora/database').createDatabaseClient();
async function main() {
  const targets = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const report = [];
  for (const { username, manager, expectedCount } of targets) {
    await db.$transaction(
      async (tx) => {
        const account = await tx.user.findUnique({
          where: { username },
          include: {
            hrEmployee: true,
            branches: true,
            roles: {
              include: {
                role: {
                  include: { permissions: { include: { permission: true } } },
                },
              },
            },
          },
        });
        if (!account || account.status !== 'ACTIVE' || !account.hrEmployee)
          throw Error('Linked active account required');
        const branchId = account.hrEmployee.branchId;
        const actor = {
          userId: account.id,
          branchIds: account.branches.map((b) => b.branchId),
          permissions: authenticatedPermissionCodes(account.roles),
        };
        const directory = new IamCallCenterDirectory({ client: tx });
        const list = await directory.requestAssignees(actor, branchId, tx);
        if (list.length !== expectedCount)
          throw Error('Unexpected live unit count');
        if (
          (await directory.canManageRequest(
            actor,
            branchId,
            account.id,
            tx,
          )) !== manager
        )
          throw Error('Live HR management authority mismatch');
        const withoutManual = await directory.requestAssignees(
          {
            ...actor,
            permissions: actor.permissions.filter(
              (p) => p !== 'customer_affairs.call_center.workflow.manage.team',
            ),
          },
          branchId,
          tx,
        );
        if (JSON.stringify(list) !== JSON.stringify(withoutManual))
          throw Error('Manual team grant still changes authority');
        if (manager && account.hrEmployee.grade !== 'مدیر')
          throw Error('Manager grade missing');
        if (!manager && (list.length !== 1 || list[0].id !== account.id))
          throw Error('Ordinary staff not self-only');
        for (const choice of list)
          await directory.resolveRequestAssignee(
            tx,
            actor,
            branchId,
            choice.id,
          );
        const foreign = await tx.hrEmployee.findFirst({
          where: {
            branchId,
            userId: { not: null },
            status: 'فعال',
            deletedAt: null,
            unit: { not: account.hrEmployee.unit },
          },
          select: { userId: true },
        });
        if (foreign?.userId) {
          let denied = false;
          try {
            await directory.resolveRequestAssignee(
              tx,
              actor,
              branchId,
              foreign.userId,
            );
          } catch (e) {
            if (e.getStatus?.() === 403) denied = true;
            else throw e;
          }
          if (!denied) throw Error('Foreign-unit assignment accepted');
        }
        report.push({
          username,
          manager,
          count: list.length,
          selectable: true,
          manualGrantIgnored: true,
          foreignUnitRejected: true,
        });
      },
      { timeout: 30000 },
    );
  }
  console.log(JSON.stringify(report));
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
