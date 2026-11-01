/** Bounded administrative repair. No grants, PBX commands or historical replay. */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function mappingDecision(
  plan,
  connection,
  user,
  hrIds,
  shared,
  eligible,
  route,
) {
  if (
    !['preview', 'apply'].includes(plan.phase) ||
    !/^\d{2,10}$/.test(plan.extension) ||
    !Number.isInteger(plan.expectedVersion) ||
    plan.expectedVersion < 0
  )
    throw Error('INVALID_PLAN');
  if (
    !connection?.active ||
    connection.synthetic ||
    connection.id !== plan.connectionId ||
    connection.branchId !== plan.branchId
  )
    throw Error('CONNECTION_CHANGED');
  if (
    !user ||
    user.username !== plan.username ||
    user.status !== 'ACTIVE' ||
    !user.branches.some((b) => b.branch.id === plan.branchId)
  )
    throw Error('ACCOUNT_CHANGED');
  if (shared || hrIds.length !== 1 || hrIds[0] !== user.id)
    throw Error('UNIQUE_HR_LINK_REQUIRED');
  if (!eligible || !route) throw Error('EXISTING_CALL_ACCESS_REQUIRED');
  const previous = connection.mappings.find(
    (m) => m.extension === plan.extension,
  );
  if (previous && previous.userId !== user.id) throw Error('MAPPING_CONFLICT');
  if (previous?.active) return { change: false, previous };
  if ((previous?.version ?? 0) !== plan.expectedVersion)
    throw Error('MAPPING_VERSION_CHANGED');
  return { change: true, previous };
}

async function run(plan) {
  const require = createRequire('/workspace/apps/api/dist/main.js');
  // This separate maintenance process must not start collectors or scheduled jobs.
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
    'hr/hr-radan-device.service',
  ]) {
    for (const value of Object.values(require('./' + file + '.js'))) {
      if (typeof value === 'function' && value.prototype?.onModuleInit)
        value.prototype.onModuleInit = function () {};
    }
  }
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('./app.module.js');
  const { DatabaseService } = require('./database/database.service.js');
  const { IamService } = require('./iam/iam.service.js');
  const {
    authenticatedPermissionCodes,
  } = require('./iam/authenticated-permissions.js');
  const { canViewRoute } = require('@nora/contracts');
  const { HrUserUnitDirectory } = require('./hr/hr-user-unit-directory.js');
  const { HrCallAnswerDirectory } = require('./hr/hr-call-answer-directory.js');
  const {
    IamCallCenterDirectory,
  } = require('./iam/iam-call-center-directory.js');
  const {
    TelephonyIntegrationService,
  } = require('./integrations/telephony.service.js');
  const {
    CallCenterTelephonyService,
  } = require('./customer-affairs/call-center-telephony.service.js');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
    abortOnError: false,
  });
  try {
    const users = await app.get(IamService).listUsers();
    const user = users.find(
      (u) => u.username === plan.username && u.status === 'ACTIVE',
    );
    if (!user) throw Error('ACCOUNT_CHANGED');
    const actor = {
      userId: user.id,
      username: user.username,
      branchIds: user.branches.map((b) => b.branch.id),
      permissions: authenticatedPermissionCodes(user.roles),
    };
    const integration = app.get(TelephonyIntegrationService);
    const settings = await integration.settings(actor);
    if (!settings.canManage)
      throw Error('EXISTING_INTEGRATION_AUTHORITY_REQUIRED');
    const connection = settings.connections.find(
      (c) => c.id === plan.connectionId,
    );
    if (process.env.ISSABEL_CONNECTION_ID !== plan.connectionId)
      throw Error('LIVE_CONNECTION_REQUIRED');
    const db = app.get(DatabaseService).client;
    const hrIds = await app
      .get(HrUserUnitDirectory)
      .callCenterAnswerAccounts(plan.branchId, plan.extension, new Date(), db);
    const hr = await app
      .get(HrCallAnswerDirectory)
      .resolve(
        plan.branchId,
        plan.extension,
        new Date().toISOString(),
        db,
        plan.connectionId,
      );
    const previous = connection?.mappings.find(
      (m) => m.extension === plan.extension,
    );
    const eligible = await app
      .get(IamCallCenterDirectory)
      .eligibleMapping(plan.branchId, user.id, previous?.teamId ?? null);
    const route = canViewRoute(
      actor.permissions,
      '/customer-affairs/call-center',
    );
    const decision = mappingDecision(
      plan,
      connection,
      user,
      hrIds,
      hr.shared,
      eligible,
      route,
    );
    const before = await app.get(CallCenterTelephonyService).snapshot(actor);
    let updated = false;
    if (plan.phase === 'apply' && decision.change) {
      await integration.mapping(actor, {
        connectionId: plan.connectionId,
        extension: plan.extension,
        userId: user.id,
        active: true,
        version: plan.expectedVersion,
        ...(previous?.teamId ? { teamId: previous.teamId } : {}),
      });
      updated = true;
    }
    const after = (await integration.settings(actor)).connections.find(
      (c) => c.id === plan.connectionId,
    );
    const mapping = after?.mappings.find((m) => m.extension === plan.extension);
    if (
      plan.phase === 'apply' &&
      (!mapping?.active || mapping.userId !== user.id)
    )
      throw Error('POSTCONDITION_FAILED');
    return {
      phase: plan.phase,
      extension: plan.extension,
      changeRequired: decision.change,
      updated,
      activeMapping: !!mapping?.active,
      mappingVersion: mapping?.version ?? 0,
      hrLinkVerified: true,
      eligible,
      route,
      ownSnapshot: true,
      pendingOffers: before.meta.total,
      permissionChanges: 0,
      historyReplayed: 0,
    };
  } finally {
    await app.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    process.stdout.write(
      JSON.stringify(await run(JSON.parse(readFileSync(0, 'utf8')))),
    );
  } catch (error) {
    process.stderr.write(
      error instanceof Error ? error.message : 'REPAIR_FAILED',
    );
    process.exitCode = 1;
  }
}
