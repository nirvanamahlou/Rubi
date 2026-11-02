/** Administrative deployment: existing native administrator, owning IAM service/CAS only. */
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('/workspace/apps/api/dist/main.js');
for (const file of [
  'procurement/procurement.exports',
  'customer-affairs/customer-affairs-reminders.service',
  'customer-affairs/call-center-workflow.service',
  'documents/documents.scan-processor',
  'integrations/issabel/issabel.service',
  'integrations/issabel/recordings.service',
  'integrations/issabel/recovery.service',
  'sales/sales-reservation-dispatcher',
  'finance/operations/finance-followup.service',
  'finance/accounting/financial-event-dispatcher',
]) {
  for (const value of Object.values(require('./' + file + '.js'))) {
    if (typeof value === 'function' && value.prototype?.onModuleInit)
      value.prototype.onModuleInit = function () {};
  }
}
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./app.module.js');
const { IamService } = require('./iam/iam.service.js');
const {
  ManualUserAccessService,
} = require('./iam/manual-user-access.service.js');
const {
  authenticatedPermissionCodes,
} = require('./iam/authenticated-permissions.js');
const {
  TelephonyIntegrationService,
} = require('./integrations/telephony.service.js');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
if (!['preview', 'apply', 'rollback'].includes(input.phase))
  throw Error('Invalid phase');
const app = await NestFactory.createApplicationContext(AppModule, {
  logger: false,
  abortOnError: false,
});
const receipt = { phase: input.phase, accounts: 0, updates: 0, before: [] };
try {
  const users = await app.get(IamService).listUsers();
  const owner = users.find(
    (u) => u.username === 'demo' && u.status === 'ACTIVE',
  );
  if (
    !owner?.roles.some(
      (r) => r.role.isActive && r.role.code === 'administrator',
    )
  )
    throw Error('Existing native administrator required');
  const actor = {
    userId: owner.id,
    username: owner.username,
    permissions: authenticatedPermissionCodes(owner.roles),
    branchIds: owner.branches.map((b) => b.branch.id),
  };
  if (!actor.permissions.includes('iam.users.manage'))
    throw Error('Native IAM authority required');
  const access = app.get(ManualUserAccessService);
  const code = 'customer_affairs.call_center.recordings.read';
  if (input.phase === 'rollback') {
    for (const row of input.before ?? []) {
      const current = await access.read(row.userId);
      const expected = {
        ...row.selection,
        permissionCodes: [
          ...new Set([...row.selection.permissionCodes, code]),
        ].sort(),
      };
      if (JSON.stringify(current.selection) !== JSON.stringify(expected))
        throw Error('Concurrent access changes retained');
      await access.save(
        row.userId,
        { ...row.selection, revision: current.revision, title: row.title },
        actor,
      );
      receipt.updates++;
    }
  } else {
    // Read Integration configuration using its existing authorized manager;
    // IAM changes still use the existing native administrator above.
    const manager = users.find(
      (u) => u.username === 'danial' && u.status === 'ACTIVE',
    );
    if (!manager) throw Error('Existing Integration manager required');
    const integrationActor = {
      userId: manager.id,
      username: manager.username,
      permissions: authenticatedPermissionCodes(manager.roles),
      branchIds: manager.branches.map((b) => b.branch.id),
    };
    const settings = await app
      .get(TelephonyIntegrationService)
      .settings(integrationActor);
    if (!settings.canManage)
      throw Error('Native Integration authority required');
    const connection = settings.connections.find(
      (c) =>
        c.id === process.env.ISSABEL_CONNECTION_ID && c.active && !c.synthetic,
    );
    if (!connection || !actor.branchIds.includes(connection.branchId))
      throw Error('Active mapped connection required');
    const targets = new Set([
      ...connection.mappings.filter((m) => m.active).map((m) => m.userId),
      ...process.env.CALL_CENTER_GLOBAL_USER_IDS.split(','),
    ]);
    const planned = [];
    for (const id of targets) {
      const user = users.find((u) => u.id === id && u.status === 'ACTIVE');
      if (
        !user ||
        !user.branches.some((b) => b.branch.id === connection.branchId)
      )
        throw Error('Mapped account changed');
      const current = await access.read(id);
      if (
        !current.selection.permissionCodes.includes(
          'customer_affairs.call_center.read',
        ) ||
        !current.selection.permissionCodes.includes(
          'customer_affairs.call_center.scope.v1',
        ) ||
        !current.selection.screenIds.includes('customer-affairs.call-center')
      )
        throw Error('Existing scoped Call Center access required');
      planned.push({ userId: id, ...current });
    }
    receipt.accounts = planned.length;
    for (const row of planned) {
      if (row.selection.permissionCodes.includes(code)) continue;
      if (input.phase === 'apply') {
        await access.save(
          row.userId,
          {
            ...row.selection,
            permissionCodes: [...row.selection.permissionCodes, code].sort(),
            revision: row.revision,
            title: row.title,
          },
          actor,
        );
        receipt.before.push(row);
        receipt.updates++;
      }
    }
  }
  process.stdout.write(JSON.stringify(receipt));
} catch (error) {
  process.stdout.write(JSON.stringify({ ...receipt, failed: true }));
  process.stderr.write(
    error instanceof Error ? error.message : 'Native recording access failed',
  );
  process.exitCode = 1;
} finally {
  await app.close();
}
