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
import { B2bAgreementWorkflowRepository } from './b2b-agreement-workflow.repository';
import { agreementTestTerms } from './agreement-test-fixtures';

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
            '-h',
            '127.0.0.1',
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
          status: 'UNDER_REVIEW',
          displayOrder: 0,
        })
      ).id;
    }, 180000);

    afterAll(async () => {
      if (client) await client.$disconnect();
      if (started) docker(['stop', container]);
    }, 30000);

    async function workflowFixture() {
      const workflow = new B2bAgreementWorkflowRepository({
        client,
      } as DatabaseService);
      const org = await client.masterOrganization.create({
        data: {
          code: `WF-${randomUUID().slice(0, 20)}`,
          legalName: 'Synthetic workflow organization',
          displayName: 'Synthetic workflow organization',
          createdByUserId: actorUserId,
          updatedByUserId: actorUserId,
        },
      });
      const reviewer = (
        await client.user.create({
          data: {
            username: `review-${randomUUID()}`,
            displayName: 'Synthetic independent reviewer',
            passwordHash: 'not-a-login-credential',
            status: 'INACTIVE',
          },
        })
      ).id;
      const scope = {
        organizationId: org.id,
        branchId,
        role: 'AGENCY' as const,
      };
      const command = { ...scope, actorUserId, requestId: randomUUID() };
      return { workflow, scope, command, reviewer };
    }

    it('stores exact multi-currency decimals and serializes duplicate commands without duplicate audits', async () => {
      const { workflow, scope, command } = await workflowFixture();
      const [a, b] = await Promise.all([
        workflow.save(command, agreementTestTerms()),
        workflow.save(command, agreementTestTerms()),
      ]);
      expect(a.id).toBe(b.id);
      expect(a.revisions).toHaveLength(1);
      expect(
        a.revisions[0]!.creditPolicies.find(
          (p) => p.currencyCode === 'IRR',
        )!.creditLimit.toString(),
      ).toBe('9007199254740993.25');
      expect(
        a.revisions[0]!.creditPolicies.find(
          (p) => p.currencyCode === 'USD',
        )!.creditLimit.toString(),
      ).toBe('12500.5');
      expect(
        await client.b2bAuditEvent.count({
          where: {
            entityId: a.revisions[0]!.id,
            action: 'b2b.agreement.draft_saved',
          },
        }),
      ).toBe(1);
      await expect(
        workflow.save(command, {
          ...agreementTestTerms(),
          title: 'Changed payload',
        }),
      ).rejects.toThrow('شناسه درخواست');
      const corporate = await workflow.save(
        { ...command, requestId: randomUUID(), role: 'CORPORATE_CUSTOMER' },
        agreementTestTerms(),
      );
      expect(corporate.profileId).not.toBe(a.profileId);
      expect((await workflow.list(scope, 1, 20)).total).toBe(1);
    });

    it('allows only one optimistic concurrent edit and rolls back the stale edit', async () => {
      const { workflow, command } = await workflowFixture();
      const row = await workflow.save(command, agreementTestTerms());
      const results = await Promise.allSettled(
        ['first', 'second'].map((title) =>
          workflow.save(
            {
              ...command,
              requestId: randomUUID(),
              agreementId: row.id,
              version: row.version,
            },
            { ...agreementTestTerms(), title },
          ),
        ),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const after = await workflow.find(command, row.id);
      expect(after.version).toBe(2);
      expect(after.revisions).toHaveLength(1);
      expect(
        await client.b2bAuditEvent.count({
          where: { entityId: after.revisions[0]!.id },
        }),
      ).toBe(2);
    });

    it('freezes submitted content, requires an independent reviewer, and preserves active terms through a rejected amendment', async () => {
      const { workflow, command, reviewer } = await workflowFixture();
      let row = await workflow.save(command, agreementTestTerms());
      const submit = {
        ...command,
        agreementId: row.id,
        version: row.version,
        requestId: randomUUID(),
      };
      row = await workflow.transition(submit, 'SUBMIT', 'بررسی مستقل');
      expect(
        (await workflow.transition(submit, 'SUBMIT', 'بررسی مستقل')).version,
      ).toBe(row.version);
      await expect(
        workflow.save(
          {
            ...command,
            agreementId: row.id,
            version: row.version,
            requestId: randomUUID(),
          },
          agreementTestTerms(),
        ),
      ).rejects.toThrow('ارسال‌شده');
      await expect(
        workflow.transition(
          {
            ...command,
            agreementId: row.id,
            version: row.version,
            requestId: randomUUID(),
          },
          'APPROVE',
          'قبول شرایط',
        ),
      ).rejects.toThrow('ثبت‌کننده');
      row = await workflow.transition(
        {
          ...command,
          actorUserId: reviewer,
          agreementId: row.id,
          version: row.version,
          requestId: randomUUID(),
        },
        'APPROVE',
        'قبول شرایط',
      );
      const activeId = row.activeRevisionId;
      expect(row.profile.status).toBe('ACTIVE');
      const revised = {
        ...agreementTestTerms(),
        title: 'اصلاحیه آزمایشی',
        changeReason: 'اصلاح شرایط',
      };
      row = await workflow.save(
        {
          ...command,
          agreementId: row.id,
          version: row.version,
          requestId: randomUUID(),
        },
        revised,
      );
      expect(row.activeRevisionId).toBe(activeId);
      expect(row.revisions[0]!.number).toBe(2);
      expect(row.title).toBe(agreementTestTerms().title);
      row = await workflow.transition(
        {
          ...command,
          agreementId: row.id,
          version: row.version,
          requestId: randomUUID(),
        },
        'SUBMIT',
        'بررسی اصلاحیه',
      );
      row = await workflow.transition(
        {
          ...command,
          actorUserId: reviewer,
          agreementId: row.id,
          version: row.version,
          requestId: randomUUID(),
        },
        'REJECT',
        'شرایط نیازمند اصلاح است',
      );
      expect(row.activeRevisionId).toBe(activeId);
      expect(row.revisions[0]!.reviewReason).toBe('شرایط نیازمند اصلاح است');
      row = await workflow.save(
        {
          ...command,
          agreementId: row.id,
          version: row.version,
          requestId: randomUUID(),
        },
        revised,
      );
      expect(row.revisions.map((r) => r.number)).toEqual([3, 2, 1]);
    });

    it('also prevents a previous draft editor from reviewing a version submitted by somebody else', async () => {
      const { workflow, command, reviewer } = await workflowFixture();
      let row = await workflow.save(command, agreementTestTerms());
      row = await workflow.save(
        {
          ...command,
          actorUserId: reviewer,
          agreementId: row.id,
          version: row.version,
          requestId: randomUUID(),
        },
        { ...agreementTestTerms(), notes: 'Edited by reviewer' },
      );
      row = await workflow.transition(
        {
          ...command,
          agreementId: row.id,
          version: row.version,
          requestId: randomUUID(),
        },
        'SUBMIT',
        'ارسال نسخه',
      );
      await expect(
        workflow.transition(
          {
            ...command,
            actorUserId: reviewer,
            agreementId: row.id,
            version: row.version,
            requestId: randomUUID(),
          },
          'APPROVE',
          'بررسی نسخه',
        ),
      ).rejects.toThrow('ویرایش‌کننده');
    });

    it('serializes approvals of overlapping agreements and approves only one', async () => {
      const { workflow, command, reviewer } = await workflowFixture();
      const rows = [];
      for (let i = 0; i < 2; i++) {
        let row = await workflow.save(
          { ...command, requestId: randomUUID() },
          agreementTestTerms(),
        );
        row = await workflow.transition(
          {
            ...command,
            agreementId: row.id,
            version: row.version,
            requestId: randomUUID(),
          },
          'SUBMIT',
          'بررسی تداخل',
        );
        rows.push(row);
      }
      const results = await Promise.allSettled(
        rows.map((row) =>
          workflow.transition(
            {
              ...command,
              actorUserId: reviewer,
              agreementId: row.id,
              version: row.version,
              requestId: randomUUID(),
            },
            'APPROVE',
            'تأیید مستقل',
          ),
        ),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(
        await client.b2bAgencyAgreement.count({
          where: { profileId: rows[0]!.profileId, status: 'ACTIVE' },
        }),
      ).toBe(1);
    });

    it('protects immutable SQL history, child terms, foreign keys and branch isolation', async () => {
      const { workflow, command, reviewer } = await workflowFixture();
      let row = await workflow.save(command, agreementTestTerms());
      row = await workflow.transition(
        {
          ...command,
          agreementId: row.id,
          version: row.version,
          requestId: randomUUID(),
        },
        'SUBMIT',
        'بررسی نسخه',
      );
      await expect(
        client.b2bAgreementRevision.update({
          where: { id: row.revisions[0]!.id },
          data: { title: 'forbidden edit' },
        }),
      ).rejects.toThrow('immutable');
      await expect(
        client.b2bAgencyCreditPolicy.update({
          where: { id: row.revisions[0]!.creditPolicies[0]!.id },
          data: { creditLimit: new Prisma.Decimal('1') },
        }),
      ).rejects.toThrow('immutable');
      await expect(
        client.b2bAgreementGuarantee.delete({
          where: { id: row.revisions[0]!.guarantees[0]!.id },
        }),
      ).rejects.toThrow('immutable');
      await expect(
        workflow.find({ ...command, branchId: randomUUID() }, row.id),
      ).rejects.toThrow('یافت نشد');
      row = await workflow.transition(
        {
          ...command,
          actorUserId: reviewer,
          agreementId: row.id,
          version: row.version,
          requestId: randomUUID(),
        },
        'APPROVE',
        'تأیید مستقل',
      );
      await expect(
        client.b2bAgreementRevision.delete({
          where: { id: row.revisions[0]!.id },
        }),
      ).rejects.toThrow('immutable');
      await expect(
        workflow.save(
          { ...command, requestId: randomUUID() },
          { ...agreementTestTerms(), documentVersionId: randomUUID() },
        ),
      ).rejects.toThrow();
      expect((await workflow.list(command, 1, 20)).total).toBe(1);
    });

    it('rolls back the complete draft and its idempotency receipt if audit insertion fails', async () => {
      const { workflow, command } = await workflowFixture();
      await client.$executeRawUnsafe(
        `CREATE FUNCTION b2b_test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='b2b.agreement.draft_saved' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`,
      );
      await client.$executeRawUnsafe(
        `CREATE TRIGGER b2b_test_fail_audit BEFORE INSERT ON b2b_audit_events FOR EACH ROW EXECUTE FUNCTION b2b_test_fail_audit()`,
      );
      try {
        await expect(
          workflow.save(command, agreementTestTerms()),
        ).rejects.toThrow('synthetic audit failure');
      } finally {
        await client.$executeRawUnsafe(
          `DROP TRIGGER b2b_test_fail_audit ON b2b_audit_events`,
        );
        await client.$executeRawUnsafe(`DROP FUNCTION b2b_test_fail_audit()`);
      }
      expect((await workflow.list(command, 1, 20)).total).toBe(0);
      expect(
        await client.b2bAgreementCommand.count({
          where: { requestId: command.requestId },
        }),
      ).toBe(0);
    });

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
        status: 'UNDER_REVIEW' as const,
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

    it('blocks lifecycle activation without changing the persisted version or history', async () => {
      const before = await repository.findProfile(organizationId, branchId);
      const auditBefore = await client.b2bAuditEvent.count({
        where: { branchId },
      });
      await expect(
        repository.upsertProfile({
          organizationId,
          branchId,
          actorUserId,
          status: 'ACTIVE',
          displayOrder: 0,
          expectedVersion: before!.version,
        }),
      ).rejects.toThrow('گردش تأیید');
      const after = await repository.findProfile(organizationId, branchId);
      expect(after?.version).toBe(before?.version);
      expect(after?.status).toBe('UNDER_REVIEW');
      expect(await client.b2bAuditEvent.count({ where: { branchId } })).toBe(
        auditBefore,
      );
    });
  },
);
