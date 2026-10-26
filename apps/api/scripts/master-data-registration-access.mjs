import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export const registrationPermissions = [
  'master_data.read',
  'master_data.create',
  'master_data.currency_rate.create',
];

export function registrationSelection(before, catalog) {
  const screens = catalog.USER_ACCESS_SCREENS.filter(
    (screen) =>
      screen.group === 'master-data' &&
      screen.id !== 'master-data.accommodation.hotel-rates',
  ).map((screen) => screen.id);
  const controls = catalog.USER_ACCESS_DENY_CONTROLS.filter(
    (control) =>
      control.id.startsWith('field.master-data.') ||
      control.id.startsWith('master-data.resource.') ||
      screens.includes(control.id),
  ).map((control) => control.id);
  const union = (existing, added) =>
    [...new Set([...existing, ...added])].sort();
  return {
    permissionCodes: union(before.permissionCodes, registrationPermissions),
    screenIds: union(before.screenIds, screens),
    allowedControlIds: union(before.allowedControlIds, controls),
  };
}

export function parseArguments(args) {
  const [mode, database, operatorId, ...usernames] = args;
  if (
    !['--preview', '--apply'].includes(mode) ||
    !database ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      operatorId ?? '',
    ) ||
    usernames.length === 0 ||
    usernames.length > 10 ||
    usernames.some((name) => !/^[a-z0-9._-]{1,80}$/i.test(name)) ||
    new Set(usernames).size !== usernames.length
  )
    throw new Error(
      'Usage: --preview|--apply expected_database operator_uuid username [username ...]',
    );
  return { mode, database, operatorId, usernames };
}

export async function run(args) {
  const { mode, database, operatorId, usernames } = parseArguments(args);
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (
    process.env.NODE_ENV === 'production' ||
    !['postgres', 'localhost', '127.0.0.1', 'host.docker.internal'].includes(
      url.hostname,
    ) ||
    decodeURIComponent(url.pathname.slice(1)) !== database
  )
    throw new Error(
      'The explicitly named local development database is required',
    );
  const require = createRequire(import.meta.url);
  require('reflect-metadata');
  const catalog = require('@nora/contracts');
  const { createDatabaseClient } = require('@nora/database');
  const {
    ManualUserAccessService,
    manualUserInclude,
  } = require('../dist/iam/manual-user-access.service.js');
  const {
    authenticatedPermissionCodes,
  } = require('../dist/iam/authenticated-permissions.js');
  const client = createDatabaseClient(url.toString());
  try {
    const operator = await client.user.findUnique({
      where: { id: operatorId },
      include: manualUserInclude,
    });
    const permissions = operator
      ? authenticatedPermissionCodes(operator.roles)
      : [];
    if (
      operator?.status !== 'ACTIVE' ||
      !operator.roles.some(
        ({ role }) => role.isActive && role.code === 'administrator',
      ) ||
      !permissions.includes('iam.users.manage')
    )
      throw new Error('An existing active administrator is required');
    const service = new ManualUserAccessService({ client });
    const plans = [];
    // Resolve every exact target and revision before any mutation.
    for (const username of usernames) {
      const user = await client.user.findUnique({
        where: { username },
        select: { id: true, status: true },
      });
      if (!user || user.status !== 'ACTIVE' || user.id === operatorId)
        throw new Error(
          'Every target must be an existing active non-operator account',
        );
      const before = await service.read(user.id);
      const selection = registrationSelection(before.selection, catalog);
      const changed = Object.keys(selection).some((key) =>
        selection[key].some((value) => !before.selection[key].includes(value)),
      );
      plans.push({ user, before, selection, changed });
    }
    const actor = {
      userId: operatorId,
      branchIds: operator.branches.map((branch) => branch.branchId),
      permissions,
    };
    for (const plan of plans) {
      if (mode === '--apply' && plan.changed) {
        await service.save(
          plan.user.id,
          {
            revision: plan.before.revision,
            title: plan.before.title,
            ...plan.selection,
          },
          actor,
        );
        const after = await service.read(plan.user.id);
        for (const key of Object.keys(plan.selection)) {
          if (
            plan.selection[key].some(
              (value) => !after.selection[key].includes(value),
            )
          )
            throw new Error('Saved access verification failed');
        }
      }
    }
    console.log(
      JSON.stringify({
        mode,
        targets: plans.length,
        changed: plans.filter((plan) => plan.changed).length,
        permissionsAdded: registrationPermissions,
        sharedRolesAndBranchesUnchanged: true,
      }),
    );
  } finally {
    await client.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await run(process.argv.slice(2));
