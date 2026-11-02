/** Administrative deployment helper. Writes only through owning module services.
 * No HTTP listener/session/token/PBX action; collector and unrelated timers stay off.
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export function extendOwnAccess(before, expertCodes) {
  return {
    permissionCodes: [
      ...new Set([...before.permissionCodes, ...expertCodes]),
    ].sort(),
    screenIds: [
      ...new Set([...before.screenIds, 'customer-affairs.call-center']),
    ].sort(),
    allowedControlIds: [...before.allowedControlIds],
  };
}

export function checkPlan(plan) {
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    !['preview', 'apply', 'rollback'].includes(plan.phase) ||
    !uuid.test(plan.branchId) ||
    !uuid.test(plan.connectionId) ||
    !Array.isArray(plan.staff) ||
    !plan.staff.length ||
    plan.staff.length > 500
  )
    throw Error('Invalid deployment plan');
  const extensions = new Set();
  for (const entry of plan.staff) {
    if (
      !uuid.test(entry.userId) ||
      !/^\d{2,10}$/.test(entry.extension) ||
      extensions.has(entry.extension)
    )
      throw Error('Ambiguous staff mapping');
    extensions.add(entry.extension);
  }
}

async function main(plan) {
  checkPlan(plan);
  const require = createRequire('/workspace/apps/api/dist/main.js');
  // Administrative context mirrors the existing IAM bootstrap, but explicitly
  // suppresses all background initializers before creating any provider instance.
  for (const file of [
    'sales/sales-reservation-dispatcher',
    'finance/operations/finance-followup.service',
    'procurement/procurement.exports',
    'integrations/issabel/recovery.service',
    'integrations/issabel/recordings.service',
    'integrations/issabel/issabel.service',
    'customer-affairs/customer-affairs-reminders.service',
    'customer-affairs/call-center-workflow.service',
    'finance/accounting/financial-event-dispatcher',
    'documents/documents.scan-processor',
  ]) {
    for (const provider of Object.values(require('./' + file + '.js'))) {
      if (typeof provider === 'function' && provider.prototype?.onModuleInit)
        provider.prototype.onModuleInit = function () {};
    }
  }
  const { NestFactory } = require('@nestjs/core');
  const { ConfigService } = require('@nestjs/config');
  const { AppModule } = require('./app.module.js');
  const { IamService } = require('./iam/iam.service.js');
  const {
    IamCallCenterDirectory,
  } = require('./iam/iam-call-center-directory.js');
  const {
    ManualUserAccessService,
  } = require('./iam/manual-user-access.service.js');
  const {
    authenticatedPermissionCodes,
  } = require('./iam/authenticated-permissions.js');
  const {
    IntegrationRegistryService,
  } = require('./integrations/integration-registry.service.js');
  const {
    TelephonyIntegrationService,
  } = require('./integrations/telephony.service.js');
  const {
    IssabelService,
  } = require('./integrations/issabel/issabel.service.js');
  const { CALL_CENTER_SALES_EXPERT } = require('@nora/contracts');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
    abortOnError: false,
  });
  let progress = null;
  try {
    const iam = app.get(IamService);
    const users = await iam.listUsers();
    const owner = users.find(
      (u) => u.username === 'danial' && u.status === 'ACTIVE',
    );
    const demo = users.find(
      (u) => u.username === 'demo' && u.status === 'ACTIVE',
    );
    if (!owner || !demo)
      throw Error('Approved operator/global account unavailable');
    const globals = new Set(
      (process.env.CALL_CENTER_GLOBAL_USER_IDS ?? '').split(','),
    );
    if (globals.size !== 2 || !globals.has(owner.id) || !globals.has(demo.id))
      throw Error('Exact global-account configuration mismatch');
    const actor = {
      userId: owner.id,
      sessionId: null,
      branchIds: owner.branches.map((b) => b.branch.id),
      permissions: authenticatedPermissionCodes(owner.roles),
    };
    if (
      !actor.permissions.includes('iam.users.manage') ||
      !actor.branchIds.includes(plan.branchId) ||
      !app.get(IntegrationRegistryService).canManage(actor)
    )
      throw Error('Operator lacks existing IAM/Integration authority');
    const directory = app.get(IamCallCenterDirectory);
    for (const userId of [owner.id, demo.id])
      if (!(await directory.globalCallCenter({ ...actor, userId })))
        throw Error('Approved global account is not eligible');
    const access = app.get(ManualUserAccessService);
    const config = app.get(ConfigService);
    const telephony = app.get(TelephonyIntegrationService);
    if (plan.phase === 'rollback') {
      const previous = plan.previous;
      if (!previous || !Array.isArray(previous.beforeAccess))
        throw Error('Missing rollback receipt');
      let restored = 0,
        conflicts = 0;
      if (previous.connectionCreated) {
        const settings = await telephony.settings(actor);
        const connection = settings.connections.find(
          (c) => c.id === previous.connectionId,
        );
        if (connection?.active) {
          config.set('ISSABEL_ENABLED', 'true');
          config.set('ISSABEL_CONNECTION_ID', connection.id);
          await app
            .get(IssabelService)
            .activate(actor, connection.id, connection.version, false);
        }
      }
      for (const entry of previous.beforeAccess) {
        const current = await access.read(entry.userId);
        const expected = extendOwnAccess(
          entry.selection,
          CALL_CENTER_SALES_EXPERT,
        );
        if (JSON.stringify(current.selection) !== JSON.stringify(expected)) {
          conflicts++;
          continue;
        }
        await access.save(
          entry.userId,
          {
            revision: current.revision,
            title: entry.title,
            ...entry.selection,
          },
          actor,
        );
        restored++;
      }
      return {
        phase: 'rollback',
        restored,
        conflicts,
        providerActivated: false,
      };
    }
    const changes = [];
    const delegable = (await access.read(owner.id)).selection;
    const accessIds = [
      ...new Set([...plan.staff.map((s) => s.userId), owner.id, demo.id]),
    ];
    for (const userId of accessIds) {
      const user = users.find((u) => u.id === userId && u.status === 'ACTIVE');
      if (!user || !user.branches.some((b) => b.branch.id === plan.branchId))
        throw Error('Linked staff account/branch changed');
      const current = await access.read(user.id);
      const desired = extendOwnAccess(
        current.selection,
        CALL_CENTER_SALES_EXPERT,
      );
      // Validate all requested deltas before writing any account. Recording
      // transfer is disabled in this rollout and grants no download authority.
      for (const key of ['permissionCodes', 'screenIds', 'allowedControlIds']) {
        const additions = desired[key].filter(
          (id) => !current.selection[key].includes(id),
        );
        if (additions.some((id) => !delegable[key].includes(id)))
          throw Error(
            'Operator cannot delegate requested Call Center access: ' + key,
          );
      }
      changes.push({ userId: user.id, current, desired });
    }
    const result = {
      phase: plan.phase,
      staff: plan.staff.length,
      accessAccounts: changes.length,
      accessUpdates: 0,
      mappings: 0,
      providerActivated: false,
      sideEffectTimersDisabled: true,
      connectionId: plan.connectionId,
      connectionCreated: false,
      beforeAccess: [],
    };
    progress = result;
    if (plan.phase === 'apply') {
      try {
        for (const change of changes) {
          if (
            JSON.stringify(change.current.selection) ===
            JSON.stringify(change.desired)
          )
            continue;
          await access.save(
            change.userId,
            {
              revision: change.current.revision,
              title: change.current.title,
              ...change.desired,
            },
            actor,
          );
          result.beforeAccess.push({
            userId: change.userId,
            ...change.current,
          });
          result.accessUpdates++;
        }
        const prior = plan.existingConnectionId
          ? (await telephony.settings(actor)).connections.find(
              (c) => c.id === plan.existingConnectionId,
            )
          : null;
        if (
          plan.existingConnectionId &&
          (!prior || prior.active || prior.branchId !== plan.branchId)
        )
          throw Error('Prior connection state changed');
        const connection =
          prior ??
          (await telephony.configure(actor, {
            branchId: plan.branchId,
            name: 'Company Issabel',
            maxAgeSeconds: 86400,
            maxFutureSeconds: 120,
          }));
        result.connectionId = connection.id;
        result.connectionCreated = true;
        for (const entry of plan.staff) {
          if (prior) {
            const matches = prior.mappings.filter(
              (m) =>
                m.extension === entry.extension &&
                m.active &&
                m.userId === entry.userId,
            );
            if (matches.length !== 1) throw Error('Prior mapping changed');
            result.mappings++;
            continue;
          }
          await telephony.mapping(actor, {
            connectionId: connection.id,
            extension: entry.extension,
            userId: entry.userId,
            active: true,
            version: 0,
          });
          result.mappings++;
        }
        config.set('ISSABEL_CONNECTION_ID', connection.id);
        config.set('ISSABEL_ENABLED', 'true');
        await app
          .get(IssabelService)
          .activate(actor, connection.id, prior?.version ?? 1, true);
        result.providerActivated = true;
      } catch (error) {
        error.bootstrapProgress = result;
        throw error;
      }
    }
    return result;
  } finally {
    try {
      await app.close();
    } catch (error) {
      if (progress) error.bootstrapProgress = progress;
      throw error;
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  try {
    const plan = JSON.parse(input);
    if (plan.environment) {
      for (const [key, value] of Object.entries(plan.environment)) {
        if (!/^[A-Z_][A-Z0-9_]*$/.test(key) || typeof value !== 'string')
          throw Error('Invalid environment');
        process.env[key] = value;
      }
      delete plan.environment;
    }
    const result = await main(plan);
    process.stdout.write(JSON.stringify(result));
  } catch (error) {
    if (error.bootstrapProgress)
      process.stdout.write(
        JSON.stringify({ ...error.bootstrapProgress, failed: true }),
      );
    process.stderr.write(
      error instanceof Error ? error.message : 'Bootstrap failed',
    );
    process.exitCode = 1;
  }
}
