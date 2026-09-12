// Local synthetic organization accounts. Credentials are written only to a private file outside Git.
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { demoAgencyNames } from './b2b-demo-agencies.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
const require = createRequire(import.meta.url);
require('reflect-metadata');
const { createDatabaseClient } = require('@rubi/database');
const { ConfigService } = require('@nestjs/config');
const { IamService } = require('../dist/iam/iam.service.js');
const {
  authenticatedPermissionCodes,
} = require('../dist/iam/authenticated-permissions.js');
const {
  MasterDataService,
} = require('../dist/master-data/master-data.service.js');
const {
  MasterDataRepository,
} = require('../dist/master-data/master-data.repository.js');
const {
  MasterDataContactCrypto,
} = require('../dist/master-data/master-data-contact.crypto.js');
const {
  MasterOrganizationDirectory,
} = require('../dist/master-data/master-organization-directory.js');
const {
  B2bOrganizationUserRepository,
} = require('../dist/b2b/b2b-organization-user.repository.js');
const {
  B2bOrganizationUserService,
} = require('../dist/b2b/b2b-organization-user.service.js');
const { B2bRepository } = require('../dist/b2b/b2b.repository.js');
const [mode, privateDirectory] = process.argv.slice(2);
if (!['--preview', '--apply'].includes(mode) || !privateDirectory)
  throw Error('Usage: --preview|--apply private_directory_outside_repository');
const repo = resolve(import.meta.dirname, '../../..'),
  output = resolve(privateDirectory),
  inside = relative(repo, output);
if (!inside || (!inside.startsWith('..') && !isAbsolute(inside)))
  throw Error('Credential output must be outside Git');
const url = new URL(process.env.DATABASE_URL ?? '');
if (
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  url.port !== '55432' ||
  process.env.NODE_ENV === 'production'
)
  throw Error('Local development database required');
url.pathname = '/rubi_hr_current_20260908';
const client = createDatabaseClient(url.toString()),
  database = { client },
  iam = new IamService(database);
const master = new MasterDataService(
  new MasterDataRepository(database),
  new MasterDataContactCrypto(new ConfigService(process.env)),
);
const repository = new B2bOrganizationUserRepository(database),
  directory = new MasterOrganizationDirectory(database);
const service = new B2bOrganizationUserService(
  repository,
  iam,
  directory,
  new B2bRepository(database),
);
const names = [
  'آژانس آزمایشی افق سفر',
  'آژانس آزمایشی آبیراه',
  'آژانس آزمایشی آسمان',
  'آژانس آزمایشی نیلگون',
];
const definitions = [
  {
    suffix: 'viewer',
    roleName: 'کارشناس مشاهده',
    sections: ['organization'],
    isActive: true,
  },
  {
    suffix: 'commercial',
    roleName: 'کارشناس قرارداد',
    sections: ['organization', 'contracts'],
    isActive: true,
  },
  {
    suffix: 'supervisor',
    roleName: 'ناظر آزمایشی',
    sections: [
      'organization',
      'access',
      'contracts',
      'credit',
      'finance',
      'audit',
    ],
    isActive: false,
  },
];
const accessState = (users) =>
  users
    .map((u) => ({
      id: u.id,
      status: u.status,
      roles: u.roles.map((r) => r.role.id).sort(),
      branches: u.branches.map((b) => b.branch.id).sort(),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
try {
  const [users, catalog] = await Promise.all([
    iam.listUsers(),
    iam.listRolesAndBranches(),
  ]);
  const administrator = users.find(
    (u) =>
      u.id === '433f37d7-6433-4df4-a0fa-fb5c6d6477a4' &&
      u.displayName === 'Nirvana' &&
      u.status === 'ACTIVE',
  );
  if (!administrator)
    throw Error('Expected authorized local administrator not found');
  const actor = {
    userId: administrator.id,
    sessionId: randomUUID(),
    branchIds: administrator.branches.map((b) => b.branch.id),
    permissions: authenticatedPermissionCodes(
      catalog.roles
        .filter((role) =>
          administrator.roles.some((r) => r.role.id === role.id),
        )
        .map((role) => ({ role })),
    ),
  };
  iam.assertPermissions(actor, ['b2b.agency.read', 'b2b.agency.manage']);
  const branchId = administrator.branches.find((b) => b.branch.code === 'HQ')
    ?.branch.id;
  if (!branchId) throw Error('HQ branch missing');
  const plan = [];
  const selectedNames = await demoAgencyNames(master, names);
  for (const [index, name] of selectedNames.entries()) {
    const matches = await master.list('organizations', {
      search: name,
      status: 'active',
      page: 1,
      pageSize: 100,
      sortBy: 'code',
      sortDirection: 'asc',
    });
    const org = matches.data.find(
      (r) =>
        r.name === name &&
        String(r.attributes.roleCodes).split(',').includes('AGENCY'),
    );
    if (!org) throw Error('Synthetic organization missing: ' + name);
    const existing = await repository.list(org.id, branchId);
    for (const d of definitions) {
      const username = `demo.agency.${process.env.B2B_DEMO_ALL_EXISTING === '1' ? org.id : index + 1}.${d.suffix}`;
      const identity = users.find((u) => u.username === username);
      const member = existing.find((m) => m.userId === identity?.id);
      if (identity && !member)
        throw Error('Unlinked existing username requires review: ' + username);
      plan.push({
        org: org.id,
        name,
        username,
        definition: d,
        exists: Boolean(member),
      });
    }
  }
  console.log(
    JSON.stringify({
      mode,
      organizations: selectedNames.length,
      toCreate: plan.filter((p) => !p.exists).length,
      existing: plan.filter((p) => p.exists).length,
    }),
  );
  if (mode === '--apply') {
    mkdirSync(output, { recursive: true });
    const credentialsFile = resolve(
      output,
      'organization-user-credentials.json',
    );
    const credentials = existsSync(credentialsFile)
      ? JSON.parse(readFileSync(credentialsFile, 'utf8'))
      : [];
    const dockerConfig = JSON.parse(
      execFileSync('docker', ['inspect', 'rubi-postgres-1'], {
        encoding: 'utf8',
      }),
    )[0];
    const postgresUser = dockerConfig.Config.Env.find((v) =>
      v.startsWith('POSTGRES_USER='),
    ).slice(14);
    const backup = execFileSync(
      'docker',
      [
        'exec',
        'rubi-postgres-1',
        'pg_dump',
        '-U',
        postgresUser,
        '-d',
        'rubi_hr_current_20260908',
        '-Fc',
        '--no-owner',
        '--no-acl',
      ],
      { maxBuffer: 256 * 1024 * 1024, timeout: 60000 },
    );
    writeFileSync(resolve(output, `before-users-${Date.now()}.dump`), backup);
    let created = 0;
    for (const p of plan) {
      if (p.exists) continue;
      const password = randomBytes(24).toString('base64url') + 'aA9!';
      // Persist the generated credential before provisioning so an uncertain response cannot lose it.
      const credential = {
        organization: p.name,
        username: p.username,
        password,
        portal: 'http://localhost:3100/login?next=%2Fagency-portal',
      };
      credentials.push(credential);
      writeFileSync(credentialsFile, JSON.stringify(credentials, null, 2), {
        mode: 0o600,
      });
      await service.create(
        p.org,
        {
          branchId,
          roleName: p.definition.roleName,
          sections: p.definition.sections,
          isActive: p.definition.isActive,
          reason: 'ثبت داده آزمایشی با درخواست مالک',
          displayName: p.definition.roleName + ' — ' + p.name,
          username: p.username,
          password,
        },
        actor,
        { userAgent: 'Rubi local organization-user fixture' },
      );
      created++;
    }
    const after = await iam.listUsers();
    if (
      JSON.stringify(accessState(users)) !==
      JSON.stringify(
        accessState(after.filter((u) => users.some((old) => old.id === u.id))),
      )
    )
      throw Error('Existing user access changed');
    for (const p of plan) {
      const identity = after.find((u) => u.username === p.username),
        member = await repository.byUser(
          identity?.id ?? '00000000-0000-4000-8000-000000000000',
        );
      if (
        !identity ||
        identity.roles.length ||
        identity.branches.length ||
        member?.organizationId !== p.org
      )
        throw Error('Fixture scope verification failed');
    }
    console.log(
      JSON.stringify({
        created,
        verified: plan.length,
        existingAccessPreserved: true,
        globalRolesGranted: 0,
        credentialsFile,
      }),
    );
  }
} finally {
  await client.$disconnect();
}
