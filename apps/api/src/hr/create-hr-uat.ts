import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { HR_PERMISSION_CODES, type AuthenticatedActor } from '@rubi/contracts';
import { createDatabaseClient, UserStatus } from '@rubi/database';

import type { DatabaseService } from '../database/database.service';
import { IamService } from '../iam/iam.service';
import { MfaTotpService } from '../iam/mfa-totp';

async function main() {
  const env = parseEnv(readFileSync(resolve(process.cwd(), '.env'), 'utf8')),
    url = new URL(env.DATABASE_URL!);
  if (
    env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.port !== '55432'
  )
    throw new Error('Local development only.');
  if (!process.argv.includes('--apply') && !process.argv.includes('--disable'))
    throw new Error('Explicit --apply or --disable is required.');
  const output = resolve(tmpdir(), 'rubi-hr005-uat.json');
  const client = createDatabaseClient(url.toString());
  try {
    const iam = new IamService(
      { client } as DatabaseService,
      new JwtService({
        secret: env.IAM_ACCESS_TOKEN_SECRET ?? 'unused-no-token-generated',
      }),
      new MfaTotpService(new ConfigService(env)),
    );
    const users = await iam.listUsers(),
      options = await iam.listRolesAndBranches();
    const admin = users.find(
      (user) =>
        user.status === 'ACTIVE' &&
        user.roles.some((role) => role.role.code === 'administrator'),
    );
    if (!admin) throw new Error('Existing administrator required.');
    const actor: AuthenticatedActor = {
      userId: admin.id,
      sessionId: admin.id,
      permissions: ['iam.users.manage', 'iam.roles.manage'],
      branchIds: admin.branches.map((row) => row.branch.id),
    };
    if (existsSync(output)) {
      const previous = JSON.parse(readFileSync(output, 'utf8')) as {
        userId: string;
        username: string;
      };
      const user = users.find(
        (item) =>
          item.id === previous.userId &&
          item.username === previous.username &&
          item.username.startsWith('hr-demo-005-'),
      );
      if (user) {
        if (process.argv.includes('--disable'))
          await iam.updateUserStatus(user.id, UserStatus.INACTIVE, actor, {});
        process.stdout.write(
          JSON.stringify({
            file: output,
            reused: true,
            disabled: process.argv.includes('--disable'),
          }) + '\n',
        );
        return;
      }
    }
    if (process.argv.includes('--disable'))
      throw new Error('Known UAT user does not exist; nothing was changed.');
    const suffix = randomUUID().slice(0, 8),
      username = `hr-demo-005-${suffix}`,
      password = `Hr005!${randomBytes(24).toString('base64url')}`;
    const permitted = new Set<string>([
      ...HR_PERMISSION_CODES,
      'documents.list',
      'documents.metadata.read',
      'documents.file.read',
      'documents.download',
      'documents.upload',
      'documents.version.create',
      'documents.metadata.update',
      'documents.hr.read',
      'documents.sensitive.read',
      'documents.sensitive.download',
    ]);
    const role = await iam.createRole(
      {
        code: `hr-uat-005-${suffix}`,
        name: 'نقش آزمایشی محدود منابع انسانی HR-005',
        permissionIds: options.permissions
          .filter((p) => permitted.has(p.code))
          .map((p) => p.id),
      },
      actor,
      {},
    );
    const user = await iam.createUser(
      {
        username,
        password,
        displayName: 'کاربر آزمایشی منابع انسانی HR-005',
        roleIds: [role.id],
        branchIds: actor.branchIds,
      },
      actor,
      {},
    );
    writeFileSync(
      output,
      JSON.stringify(
        {
          userId: user.id,
          username,
          password,
          roleId: role.id,
          branchIds: actor.branchIds,
          createdAt: new Date().toISOString(),
          purpose: 'HR-005 local UAT only',
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    process.stdout.write(
      JSON.stringify({
        file: output,
        created: true,
        globalAdministrator: false,
        existingUsersChanged: 0,
      }) + '\n',
    );
  } finally {
    await client.$disconnect();
  }
}
void main().catch(() => {
  process.stderr.write(
    'Local HR UAT account operation failed; credentials were not printed.\n',
  );
  process.exitCode = 1;
});
