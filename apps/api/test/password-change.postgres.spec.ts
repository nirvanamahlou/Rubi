import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { JwtService } from '@nestjs/jwt';
import {
  createDatabaseClient,
  SessionStatus,
  type DatabaseClient,
} from '@rubi/database';
import { hash, verify } from 'argon2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DatabaseService } from '../src/database/database.service';
import { IamService } from '../src/iam/iam.service';
import type { MfaTotpService } from '../src/iam/mfa-totp';
import { changeIamPassword } from '../src/iam/password-change';
import { postgresTestTarget } from './postgres-test-target';

const enabled = process.env.RUBI_RUN_PASSWORD_POSTGRES_TESTS === '1';
const target = postgresTestTarget();
const databaseName = `rubi_password_test_${randomUUID().replaceAll('-', '')}`;
let created = false;
let client: DatabaseClient;
const oldPassword = 'Old-Fixture-123!';
const newPassword = 'New-Fixture-456!';
const jwt = new JwtService({ secret: 'isolated-password-test-signing-only' });
function sql(database: string, input: string) {
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      target.container,
      'psql',
      '-U',
      target.user,
      '-d',
      database,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input, stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000 },
  );
}
function service(db = client) {
  return new IamService(
    { client: db } as DatabaseService,
    jwt,
    {} as MfaTotpService,
  );
}
async function fixture() {
  const user = await client.user.create({
    data: {
      username: `pw_${randomUUID().replaceAll('-', '')}`,
      displayName: 'Password fixture',
      passwordHash: await hash(oldPassword, {
        type: 2,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      }),
    },
  });
  const auth = service();
  const login = await auth.login(user.username, oldPassword, {});
  return {
    user,
    auth,
    login,
    actor: await auth.authenticate(login.accessToken),
  };
}
function pauseRead(model: 'user' | 'session') {
  let reached!: () => void;
  let release!: () => void;
  const read = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const delegate = client[model];
  const db = new Proxy(client, {
    get(db, property) {
      if (property !== model) return Reflect.get(db, property);
      return new Proxy(delegate, {
        get(source, method) {
          if (method !== 'findUnique') return Reflect.get(source, method);
          return async (args: unknown) => {
            const result = await (
              source.findUnique as (args: unknown) => Promise<unknown>
            )(args);
            reached();
            await gate;
            return result;
          };
        },
      });
    },
  });
  return { db, read, release };
}

describe.skipIf(!enabled)(
  'password change on isolated PostgreSQL',
  { timeout: 30000 },
  () => {
    beforeAll(async () => {
      const configured = new URL(process.env.DATABASE_URL!);
      if (
        !['localhost', '127.0.0.1'].includes(configured.hostname) ||
        configured.port !== target.port ||
        !/^rubi_password_test_[a-f0-9]{32}$/.test(databaseName)
      )
        throw new Error('Isolated local database required');
      sql('postgres', `CREATE DATABASE "${databaseName}";`);
      created = true;
      const migrations = resolve(
        process.cwd(),
        '../../packages/database/prisma/migrations',
      );
      const migrationSql = readdirSync(migrations, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((entry) =>
          readFileSync(
            resolve(migrations, entry.name, 'migration.sql'),
            'utf8',
          ),
        )
        .join('\n');
      sql(databaseName, migrationSql);
      configured.pathname = `/${databaseName}`;
      client = createDatabaseClient(configured.toString());
    }, 120000);
    afterAll(async () => {
      await client?.$disconnect();
      if (created && /^rubi_password_test_[a-f0-9]{32}$/.test(databaseName))
        sql('postgres', `DROP DATABASE "${databaseName}" WITH (FORCE);`);
    });
    it('changes only the current user, revokes every session, rejects old login and retains secret-free audit', async () => {
      const { user, actor, auth, login } = await fixture();
      const other = await fixture();
      await auth.login(user.username, oldPassword, {});
      await auth.changePassword(actor, oldPassword, newPassword, {});
      const stored = await client.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(await verify(stored.passwordHash, newPassword)).toBe(true);
      expect(
        await client.session.count({
          where: { userId: user.id, status: SessionStatus.ACTIVE },
        }),
      ).toBe(0);
      await expect(auth.authenticate(login.accessToken)).rejects.toThrow();
      await expect(auth.refresh(login.refreshToken, {})).rejects.toThrow();
      await expect(
        auth.login(user.username, oldPassword, {}),
      ).rejects.toThrow();
      await expect(
        auth.login(user.username, newPassword, {}),
      ).resolves.toBeDefined();
      await expect(
        other.auth.authenticate(other.login.accessToken),
      ).resolves.toBeDefined();
      const audit = await client.auditEvent.findMany({
        where: { actorUserId: user.id, action: 'auth.password.change' },
      });
      expect(audit).toHaveLength(1);
      expect(audit[0]!.outcome).toBe('SUCCESS');
      const serialized = JSON.stringify(audit);
      for (const secret of [
        oldPassword,
        newPassword,
        stored.passwordHash,
        login.refreshToken,
      ])
        expect(serialized).not.toContain(secret);
    });
    it('commits failure counts, limits repeated guesses and preserves the hash', async () => {
      const { user, actor, auth } = await fixture();
      for (let i = 0; i < 5; i++)
        await expect(
          auth.changePassword(actor, 'incorrect', newPassword, {}),
        ).rejects.toThrow();
      const stored = await client.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(stored.failedLoginAttempts).toBe(5);
      expect(stored.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
      expect(stored.passwordHash).toBe(user.passwordHash);
      await expect(
        auth.changePassword(actor, oldPassword, newPassword, {}),
      ).rejects.toMatchObject({ status: 429 });
    });
    it('rejects weak/same passwords and wrong-user or revoked sessions', async () => {
      const { actor, auth } = await fixture();
      const other = await fixture();
      await expect(
        auth.changePassword(actor, oldPassword, 'weak', {}),
      ).rejects.toThrow();
      await expect(
        auth.changePassword(actor, oldPassword, oldPassword, {}),
      ).rejects.toThrow();
      await expect(
        auth.changePassword(
          { ...actor, sessionId: other.actor.sessionId },
          oldPassword,
          newPassword,
          {},
        ),
      ).rejects.toThrow();
      await auth.logout(actor.sessionId, actor.userId, {});
      await expect(
        auth.changePassword(actor, oldPassword, newPassword, {}),
      ).rejects.toThrow();
    });
    it('rolls back password and revocation if audit fails', async () => {
      const { user, actor } = await fixture();
      const db = new Proxy(client, {
        get(db, key) {
          if (key !== '$transaction') return Reflect.get(db, key);
          return (fn: (tx: unknown) => Promise<unknown>) =>
            client.$transaction((tx) =>
              fn(
                new Proxy(tx, {
                  get(tx, key) {
                    if (key === 'auditEvent')
                      return {
                        create: async () => {
                          throw new Error('fixture audit failure');
                        },
                      };
                    return Reflect.get(tx, key);
                  },
                }),
              ),
            );
        },
      });
      await expect(
        changeIamPassword(db, actor, oldPassword, newPassword, {}),
      ).rejects.toThrow('fixture audit failure');
      expect(
        (await client.user.findUniqueOrThrow({ where: { id: user.id } }))
          .passwordHash,
      ).toBe(user.passwordHash);
      expect(
        await client.session.count({
          where: { userId: user.id, status: SessionStatus.ACTIVE },
        }),
      ).toBe(1);
    });
    it('rejects an old-password login paused before password change committed', async () => {
      const { user, actor, auth } = await fixture();
      const paused = pauseRead('user');
      const login = service(paused.db)
        .login(user.username, oldPassword, {})
        .then(
          () => 'accepted',
          () => 'rejected',
        );
      await paused.read;
      try {
        await auth.changePassword(actor, oldPassword, newPassword, {});
      } finally {
        paused.release();
      }
      expect(await login).toBe('rejected');
      expect(
        await client.session.count({
          where: { userId: user.id, status: SessionStatus.ACTIVE },
        }),
      ).toBe(0);
    });
    it('rejects refresh paused before password change committed', async () => {
      const { user, actor, auth, login } = await fixture();
      const paused = pauseRead('session');
      const refreshed = service(paused.db)
        .refresh(login.refreshToken, {})
        .then(
          () => 'accepted',
          () => 'rejected',
        );
      await paused.read;
      try {
        await auth.changePassword(actor, oldPassword, newPassword, {});
      } finally {
        paused.release();
      }
      expect(await refreshed).toBe('rejected');
      expect(
        await client.session.count({
          where: { userId: user.id, status: SessionStatus.ACTIVE },
        }),
      ).toBe(0);
    });
    it('allows only one concurrent password change from the same session', async () => {
      const { actor, auth } = await fixture();
      const results = await Promise.allSettled([
        auth.changePassword(actor, oldPassword, newPassword, {}),
        auth.changePassword(actor, oldPassword, 'Other-Fixture-789!', {}),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
    });
  },
);
