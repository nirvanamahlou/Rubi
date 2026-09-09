import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createDatabaseClient,
  Prisma,
  type DatabaseClient,
} from '@rubi/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import { B2bRepository } from './b2b.repository';

const enabled = process.env.RUBI_RUN_B2B_POSTGRES_TESTS === '1';
const container = `rubi-test-b2b-${randomUUID().slice(0, 8)}`;
let started = false;
let client: DatabaseClient;
let repository: B2bRepository;
let profileId: string;
let branchId: string;
let actorUserId: string;
let organizationId: string;
function docker(args: string[], input?: string) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30000,
    ...(input ? { input } : {}),
  }).trim();
}

describe.skipIf(!enabled)(
  'B2B transactions on disposable PostgreSQL 18',
  () => {
    beforeAll(async () => {
      // No existing container, application database, environment file or volume is used.
      docker([
        'run',
        '--pull=never',
        '--rm',
        '-d',
        '--name',
        container,
        '--tmpfs',
        '/var/lib/postgresql',
        '-e',
        'POSTGRES_PASSWORD=b2b_test_only',
        '-e',
        'POSTGRES_DB=b2b_test',
        '-p',
        '127.0.0.1::5432',
        'postgres:18.1-alpine',
      ]);
      started = true;
      let ready = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        try {
          docker([
            'exec',
            container,
            'pg_isready',
            '-U',
            'postgres',
            '-d',
            'b2b_test',
          ]);
          ready = true;
          break;
        } catch {
          await new Promise((done) => setTimeout(done, 250));
        }
      }
      if (!ready) throw new Error('Disposable PostgreSQL did not become ready');
      const port = docker(['port', container, '5432/tcp']).split(':').at(-1)!;
      if (!/^\d+$/.test(port)) throw new Error('Invalid disposable port');
      const url = `postgresql://postgres:b2b_test_only@127.0.0.1:${port}/b2b_test`;
      const migrations = resolve(
        process.cwd(),
        '../../packages/database/prisma/migrations',
      );
      for (const entry of readdirSync(migrations, { withFileTypes: true })
        .filter((item) => item.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name))) {
        docker(
          [
            'exec',
            '-i',
            container,
            'psql',
            '-U',
            'postgres',
            '-d',
            'b2b_test',
            '-v',
            'ON_ERROR_STOP=1',
          ],
          readFileSync(
            resolve(migrations, entry.name, 'migration.sql'),
            'utf8',
          ),
        );
      }
      const env = {
        ...process.env,
        DATABASE_URL: url,
        CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64:
          randomBytes(32).toString('base64'),
        CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64:
          randomBytes(32).toString('base64'),
        CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: '1',
      };
      for (let run = 0; run < 2; run++)
        execFileSync(process.execPath, ['--import', 'tsx', 'prisma/seed.ts'], {
          cwd: resolve(process.cwd(), '../../packages/database'),
          env,
          stdio: 'pipe',
          timeout: 60000,
        });
      client = createDatabaseClient(url);
      repository = new B2bRepository({ client } as DatabaseService);
      actorUserId = (
        await client.user.create({
          data: {
            username: 'b2b-test-actor',
            displayName: 'Synthetic B2B actor',
            passwordHash: 'not-a-login-credential',
            status: 'INACTIVE',
          },
        })
      ).id;
      branchId = (
        await client.branch.create({
          data: { code: 'B2B-TEST', name: 'B2B isolated test' },
        })
      ).id;
      organizationId = (
        await client.masterOrganization.create({
          data: {
            code: 'B2B-TEST',
            legalName: 'Synthetic organization',
            displayName: 'Synthetic organization',
            createdByUserId: actorUserId,
            updatedByUserId: actorUserId,
          },
        })
      ).id;
      profileId = (
        await repository.upsertProfile({
          organizationId,
          branchId,
          actorUserId,
          accountManagerUserId: null,
          status: 'ACTIVE',
          displayOrder: 0,
        })
      ).id;
    }, 180000);

    afterAll(async () => {
      if (client) await client.$disconnect();
      if (started) docker(['stop', container]);
    }, 30000);

    const rate = (code: string) => ({
      profileId,
      branchId,
      actorUserId,
      code,
      serviceReference: 'HOTEL',
      title: 'Synthetic rate',
      kind: 'DISCOUNT_PERCENT' as const,
      value: new Prisma.Decimal('5.125'),
      currencyCode: null,
      validFrom: new Date('2026-09-01T00:00:00Z'),
      validTo: new Date('2026-09-30T00:00:00Z'),
    });

    it('serializes concurrent overlapping rates and commits only one rate and audit', async () => {
      const results = await Promise.allSettled([
        repository.createRate(rate('RATE-TEST-1')),
        repository.createRate(rate('RATE-TEST-2')),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      const failure = results.find((result) => result.status === 'rejected');
      expect(
        failure?.status === 'rejected' && failure.reason.getResponse().code,
      ).toBe('B2B_RATE_OVERLAP');
      expect(
        await client.b2bAgencyAgreedRate.count({ where: { profileId } }),
      ).toBe(1);
      expect(
        await client.b2bAuditEvent.count({
          where: { branchId, action: 'b2b.rate.create' },
        }),
      ).toBe(1);
    });

    it('allows adjacent nonoverlapping dates and independent commission kind', async () => {
      await repository.createRate({
        ...rate('RATE-TEST-3'),
        validFrom: new Date('2026-10-01T00:00:00Z'),
        validTo: null,
      });
      await repository.createRate({
        ...rate('RATE-TEST-4'),
        kind: 'COMMISSION_PERCENT',
      });
      expect(
        await client.b2bAgencyAgreedRate.count({ where: { profileId } }),
      ).toBe(3);
    });

    it('rolls back the rate when its audit fails', async () => {
      await expect(
        repository.createRate({
          ...rate('RATE-TEST-5'),
          actorUserId: randomUUID(),
          serviceReference: 'FLIGHT',
        }),
      ).rejects.toThrow();
      expect(
        await client.b2bAgencyAgreedRate.count({
          where: { code: 'RATE-TEST-5' },
        }),
      ).toBe(0);
    });

    it('rejects a stale profile version and records only the accepted update', async () => {
      const input = {
        organizationId,
        branchId,
        actorUserId,
        accountManagerUserId: null,
        displayOrder: 0,
        status: 'SUSPENDED' as const,
        expectedVersion: 1,
      };
      await repository.upsertProfile(input);
      await expect(repository.upsertProfile(input)).rejects.toThrow('هم‌زمان');
      expect(
        (await repository.findProfile(organizationId, branchId))?.version,
      ).toBe(2);
      expect(
        await client.b2bAuditEvent.count({
          where: { branchId, action: 'b2b.agency.update' },
        }),
      ).toBe(1);
    });
  },
);
