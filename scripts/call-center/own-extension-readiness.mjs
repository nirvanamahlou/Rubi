/** Read-only native IAM/Integration readiness; never claims or changes a call. */
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
  authenticatedPermissionCodes,
} = require('./iam/authenticated-permissions.js');
const {
  TelephonyIntegrationService,
} = require('./integrations/telephony.service.js');
const { canViewRoute } = require('@nora/contracts');
const {
  IamCallCenterDirectory,
} = require('./iam/iam-call-center-directory.js');
const {
  CallCenterTelephonyService,
} = require('./customer-affairs/call-center-telephony.service.js');
const {
  CallCenterService,
} = require('./customer-affairs/call-center.service.js');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
if (input.phase !== 'preview') throw Error('Read-only preview required');
const app = await NestFactory.createApplicationContext(AppModule, {
  logger: false,
  abortOnError: false,
});
try {
  const users = await app.get(IamService).listUsers();
  const actorFor = (username) => {
    const u = users.find(
      (u) => u.username === username && u.status === 'ACTIVE',
    );
    if (!u) throw Error('Existing administrator required');
    return {
      userId: u.id,
      username: u.username,
      branchIds: u.branches.map((b) => b.branch.id),
      permissions: authenticatedPermissionCodes(u.roles),
    };
  };
  const manager = actorFor('danial');
  const integration = app.get(TelephonyIntegrationService);
  const settings = await integration.settings(manager);
  const connection = settings.connections.find(
    (c) =>
      c.id === process.env.ISSABEL_CONNECTION_ID && c.active && !c.synthetic,
  );
  if (!settings.canManage || !connection)
    throw Error('Active managed connection required');
  const rows = input.extensions.filter(
    (e) => e.branch_id === connection.branchId && e.status === 'فعال',
  );
  const candidates = rows.filter(
    (e) =>
      e.user_id && rows.filter((r) => r.extension === e.extension).length === 1,
  );
  const report = {
    phase: input.phase,
    extensions: rows.length,
    eligible: 0,
    updates: 0,
    unresolved: rows.length - candidates.length,
    checks: [],
  };
  for (const e of candidates) {
    const user = users.find(
      (u) =>
        u.id === e.user_id &&
        u.status === 'ACTIVE' &&
        u.branches.some((b) => b.branch.id === connection.branchId),
    );
    if (!user) throw Error('Active linked employee required');
    const mapping = connection.mappings.find(
      (m) => m.extension === e.extension,
    );
    if (mapping?.active && mapping.userId !== user.id)
      throw Error('Conflicting active mapping retained');
    if (!mapping?.active || mapping.userId !== user.id)
      throw Error('Employee extension needs native mapping');
    const actor = actorFor(user.username);
    const allowed = await app
      .get(IamCallCenterDirectory)
      .eligibleMapping(connection.branchId, user.id, mapping?.teamId ?? null);
    const route = canViewRoute(
      actor.permissions,
      '/customer-affairs/call-center',
    );
    const snapshot =
      allowed && route
        ? await app.get(CallCenterTelephonyService).snapshot(actor)
        : null;
    report.checks.push({
      username: user.username,
      extension: e.extension,
      eligible: allowed,
      route,
      ownSnapshot: !!snapshot,
      offered: snapshot?.meta.total ?? 0,
    });
    if (allowed && route) report.eligible++;
    if (input.verifyExtension === e.extension && snapshot) {
      const rows = snapshot.incoming ?? snapshot.data;
      const target = rows.find(
        (row) =>
          !row.synthetic &&
          (!input.verifySession || row.id === input.verifySession),
      );
      if (target) {
        const [call] = await app
          .get(CallCenterService)
          .hydrateDestinations(connection.branchId, [
            { ...target.call, id: target.callId },
          ]);
        report.destinationCheck = {
          extension: call.answerRecipient?.extension ?? null,
          label: call.answerRecipient?.label ?? null,
          answeredAt: call.answerRecipient?.answeredAt ?? null,
        };
        const other = candidates.find((row) => row.user_id !== user.id);
        const otherUser = users.find((u) => u.id === other?.user_id);
        if (otherUser) {
          try {
            await app
              .get(CallCenterTelephonyService)
              .read(actorFor(otherUser.username), target.id);
            throw Error('Foreign offer was readable');
          } catch (error) {
            if (error?.getStatus?.() !== 404) throw error;
            report.foreignOfferDenied = true;
          }
        }
      }
    }
  }
  process.stdout.write(JSON.stringify(report));
} finally {
  await app.close();
}
