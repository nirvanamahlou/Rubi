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
import { B2bActivityRepository } from './b2b-activity.repository';
import { activityWindow } from '../common/organization-activity';
import { DocumentsRepository } from '../documents/documents.repository';
import type { NotificationsService } from '../notifications/notifications.service';
import { B2bSignatoryRepository } from './b2b-signatory.repository';
import { B2bOrganizationUserRepository } from './b2b-organization-user.repository';
import { B2bAgreementWorkflowRepository } from './b2b-agreement-workflow.repository';
import { agreementTestTerms } from './agreement-test-fixtures';
import { MasterOrganizationDirectory } from '../master-data/master-organization-directory';
import type { AuthenticatedActor } from '@rubi/contracts';

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

    it('projects dated activity across owners, preserves deleted history and enforces scope with stable pages', async () => {
      const db = { client } as DatabaseService;
      const activity = new B2bActivityRepository(db);
      const actor = {
        userId: actorUserId,
        branchIds: [branchId],
        permissions: [
          'b2b.agency.read',
          'b2b.rate.read',
          'master_data.audit.read',
          'documents.audit.read',
          'documents.organization.read',
        ],
      } as AuthenticatedActor;
      const occurredAt = new Date('2025-01-02T00:00:00Z');
      const scope = { from: '2025-01-02', to: '2025-01-02' };
      await client.b2bAuditEvent.createMany({
        data: Array.from({ length: 65 }, () => ({
          id: randomUUID(),
          actorUserId,
          branchId,
          occurredAt,
          action: 'b2b.rate.delete',
          entityType: 'B2bAgencyAgreedRate',
          entityId: randomUUID(),
          beforeSnapshot: { profileId, value: '999', notes: 'never disclose' },
          afterSnapshot: { deleted: true },
        })),
      });
      await client.b2bAuditEvent.create({
        data: {
          actorUserId,
          branchId,
          occurredAt,
          action: 'b2b.rate.delete',
          entityType: 'B2bAgencyAgreedRate',
          entityId: randomUUID(),
          beforeSnapshot: { profileId: randomUUID() },
        },
      });
      const window = activityWindow(scope);
      const first = await activity.activity(
        organizationId,
        branchId,
        actor,
        window,
      );
      expect(first).toHaveLength(51);
      expect(JSON.stringify(first)).not.toContain('never disclose');
      const last = first[49]!;
      const second = await activity.activity(organizationId, branchId, actor, {
        ...window,
        before: { time: last.occurredAt, id: last.id },
      });
      expect(second).toHaveLength(15);
      expect(
        new Set([...first.slice(0, 50), ...second].map((row) => row.id)).size,
      ).toBe(65);
      expect(
        await activity.activity(randomUUID(), branchId, actor, window),
      ).toEqual([]);
      expect(
        await activity.activity(organizationId, randomUUID(), actor, window),
      ).toEqual([]);
      expect(
        await activity.activity(
          organizationId,
          branchId,
          { ...actor, permissions: ['b2b.agency.read'] },
          window,
        ),
      ).toEqual([]);
      expect(
        await activity.activity(
          organizationId,
          branchId,
          actor,
          activityWindow({ from: '2025-01-03', to: '2025-01-03' }),
        ),
      ).toEqual([]);

      const deletedContactId = randomUUID();
      await client.masterDataAuditEvent.createMany({
        data: [
          {
            actorUserId,
            actorBranchId: branchId,
            occurredAt,
            resource: 'organization-contacts',
            action: 'master_data.create',
            entityId: deletedContactId,
            outcome: 'SUCCESS',
            afterSnapshot: { organizationId, fullName: 'Private contact' },
          },
          {
            actorUserId,
            actorBranchId: branchId,
            occurredAt,
            resource: 'organization-contacts',
            action: 'master_data.delete',
            entityId: deletedContactId,
            outcome: 'SUCCESS',
            beforeSnapshot: { id: deletedContactId, version: 1 },
          },
        ],
      });
      const directory = new MasterOrganizationDirectory(db);
      const master = await directory.organizationActivity(
        organizationId,
        branchId,
        actor,
        window,
      );
      expect(
        master.filter((row) => row.entityId === deletedContactId),
      ).toHaveLength(2);
      expect(JSON.stringify(master)).not.toContain('Private contact');
      expect(
        await directory.organizationActivity(
          randomUUID(),
          branchId,
          actor,
          window,
        ),
      ).toEqual([]);

      const movedContactId = randomUUID(),
        otherOrganizationId = randomUUID();
      await client.masterDataAuditEvent.createMany({
        data: [
          {
            actorUserId,
            actorBranchId: branchId,
            occurredAt: new Date('2025-01-02T00:00:01Z'),
            resource: 'organization-contacts',
            action: 'master_data.create',
            entityId: movedContactId,
            outcome: 'SUCCESS',
            afterSnapshot: { organizationId },
          },
          {
            actorUserId,
            actorBranchId: branchId,
            occurredAt: new Date('2025-01-02T00:00:02Z'),
            resource: 'organization-contacts',
            action: 'master_data.update',
            entityId: movedContactId,
            outcome: 'SUCCESS',
            beforeSnapshot: { organizationId },
            afterSnapshot: { organizationId: otherOrganizationId },
          },
          {
            actorUserId,
            actorBranchId: branchId,
            occurredAt: new Date('2025-01-02T00:00:03Z'),
            resource: 'organization-contacts',
            action: 'master_data.delete',
            entityId: movedContactId,
            outcome: 'SUCCESS',
            beforeSnapshot: { id: movedContactId, version: 2 },
          },
        ],
      });
      const former = (
        await directory.organizationActivity(
          organizationId,
          branchId,
          actor,
          window,
        )
      ).filter((row) => row.entityId === movedContactId);
      const next = (
        await directory.organizationActivity(
          otherOrganizationId,
          branchId,
          actor,
          window,
        )
      ).filter((row) => row.entityId === movedContactId);
      expect(former.map((row) => row.action)).toEqual([
        'master_data.update',
        'master_data.create',
      ]);
      expect(next.map((row) => row.action)).toEqual([
        'master_data.delete',
        'master_data.update',
      ]);

      const documents = new DocumentsRepository(db, {
        createWithinTransaction: async () => {},
      } as unknown as NotificationsService);
      const type = await client.documentType.findFirstOrThrow({
        where: { domain: 'ORGANIZATION' },
      });
      const document = await client.document.create({
        data: {
          title: 'Private synthetic proof',
          documentTypeId: type.id,
          branchId,
          ownerUserId: actorUserId,
          createdByUserId: actorUserId,
          updatedByUserId: actorUserId,
          sourceModule: 'master-data',
          sourceEntityType: 'organizations',
          sourceEntityId: organizationId,
          relations: {
            create: {
              relationType: 'PRIMARY_CASE',
              sourceModule: 'master-data',
              sourceEntityType: 'organizations',
              sourceEntityId: organizationId,
              displayLabel: 'Private synthetic organization',
            },
          },
        },
      });
      const version = await client.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: 1,
          storageObjectKey: `synthetic/${randomUUID()}`,
          originalFileName: 'test.png',
          safeDownloadName: 'test.png',
          detectedMimeType: 'image/png',
          extension: 'png',
          sizeBytes: 100n,
          sha256: 'a'.repeat(64),
          versionNote: 'test',
          createdByUserId: actorUserId,
        },
      });
      await client.document.update({
        where: { id: document.id },
        data: { currentVersionId: version.id, currentVersionNumber: 1 },
      });
      await client.documentAuditEvent.create({
        data: {
          documentId: document.id,
          versionId: version.id,
          actorUserId,
          actorBranchId: branchId,
          occurredAt,
          action: 'documents.upload',
          outcome: 'SUCCESS',
          ipSummary: '',
          userAgentSummary: '',
        },
      });
      const docEvents = await documents.organizationActivity(
        organizationId,
        branchId,
        actor.permissions,
        window,
      );
      expect(docEvents).toHaveLength(1);
      expect(
        await documents.organizationActivity(
          organizationId,
          branchId,
          [],
          window,
        ),
      ).toEqual([]);
      expect(
        await documents.organizationActivity(
          randomUUID(),
          branchId,
          actor.permissions,
          window,
        ),
      ).toEqual([]);
      await client.document.update({
        where: { id: document.id },
        data: { confidentiality: 'CONFIDENTIAL' },
      });
      expect(
        await documents.organizationActivity(
          organizationId,
          branchId,
          actor.permissions,
          window,
        ),
      ).toEqual([]);
      await client.document.update({
        where: { id: document.id },
        data: { confidentiality: 'INTERNAL' },
      });
      expect(
        await documents.permanentlyDelete({
          documentId: document.id,
          expectedVersion: 1,
          actorUserId,
          ownerUserId: actorUserId,
          documentTitle: document.title,
        }),
      ).toBe(true);
      expect(await documents.findDetail(document.id, [branchId])).toBeNull();
      expect(
        await client.documentVersion.count({
          where: { documentId: document.id },
        }),
      ).toBe(0);
      expect(
        await client.documentAuditEvent.count({
          where: { documentId: document.id },
        }),
      ).toBe(2);
      const remaining = await documents.organizationActivity(
        organizationId,
        branchId,
        actor.permissions,
        activityWindow({}),
      );
      expect(
        remaining.some((row) => row.action === 'documents.permanently-delete'),
      ).toBe(true);
      expect(remaining.some((row) => row.action === 'documents.upload')).toBe(
        true,
      );
      expect(JSON.stringify(remaining)).not.toContain('Private');
      expect(
        await documents.permanentlyDelete({
          documentId: document.id,
          expectedVersion: 2,
          actorUserId,
          ownerUserId: actorUserId,
          documentTitle: document.title,
        }),
      ).toBe(false);
    });

    it('persists scoped organization-user grants with optimistic concurrency and atomic audit', async () => {
      const users = new B2bOrganizationUserRepository({
        client,
      } as DatabaseService);
      const identity = await client.user.create({
        data: {
          username: 'portal-' + randomUUID(),
          displayName: 'Synthetic portal user',
          passwordHash: 'unusable-test-hash',
        },
      });
      const input = {
        branchId,
        roleName: 'Reader',
        sections: ['organization' as const],
        isActive: true,
        reason: 'Synthetic create',
      };
      const row = await users.save(
        organizationId,
        input,
        actorUserId,
        undefined,
        identity.id,
      );
      expect((await users.byUser(identity.id))?.sections).toEqual([
        'organization',
      ]);
      const updates = await Promise.allSettled([
        users.save(
          organizationId,
          { ...input, sections: ['credit'], version: 1 },
          actorUserId,
          row.id,
        ),
        users.save(
          organizationId,
          { ...input, sections: ['contracts'], version: 1 },
          actorUserId,
          row.id,
        ),
      ]);
      expect(updates.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      await expect(
        users.save(randomUUID(), { ...input, version: 2 }, actorUserId, row.id),
      ).rejects.toThrow();
      const before = await users.byUser(identity.id);
      await expect(
        users.save(
          organizationId,
          { ...input, version: 2, isActive: false },
          randomUUID(),
          row.id,
        ),
      ).rejects.toThrow();
      expect(await users.byUser(identity.id)).toEqual(before);
      await expect(
        client.b2bOrganizationUser.update({
          where: { id: row.id },
          data: { sections: ['dashboard'] },
        }),
      ).rejects.toThrow();
      await users.save(
        organizationId,
        { ...input, version: 2, isActive: false, sections: [] },
        actorUserId,
        row.id,
      );
      expect((await users.byUser(identity.id))?.isActive).toBe(false);
      expect(
        await users.history(organizationId, branchId, [row.id]),
      ).toHaveLength(3);
    });

    it('persists signatory limits, scopes edits/deletes and atomically audits optimistic updates', async () => {
      const signatories = new B2bSignatoryRepository({
        client,
      } as DatabaseService);
      const contact = await client.masterOrganizationContact.create({
        data: {
          organizationId,
          code: `SIGN-${randomUUID().slice(0, 20)}`,
          fullName: 'Synthetic signatory',
          phoneEncrypted: 'synthetic-test-ciphertext',
          phoneEncryptionIv: 'test-iv',
          phoneEncryptionAuthTag: 'test-tag',
          phoneEncryptionKeyVersion: 1,
          phoneMasked: '09*****0000',
          phoneFingerprint: randomUUID(),
          createdByUserId: actorUserId,
          updatedByUserId: actorUserId,
        },
      });
      const scope = { organizationId, branchId };
      const values = {
        contactId: contact.id,
        documentTypes: ['FRAMEWORK_AGREEMENT'],
        authorityLimit: new Prisma.Decimal('9007199254740993.1234'),
        currencyCode: 'IRR',
        validFrom: new Date('2026-09-01T00:00:00Z'),
        validTo: null,
        documentVersionId: null,
        isActive: false,
        notes: 'Synthetic authority',
      };
      const row = await signatories.save(scope, values, actorUserId);
      expect(row.authorityLimit?.toString()).toBe('9007199254740993.1234');
      const results = await Promise.allSettled([
        signatories.save(
          scope,
          { ...values, notes: 'Edit A' },
          actorUserId,
          row.id,
          1,
        ),
        signatories.save(
          scope,
          { ...values, notes: 'Edit B' },
          actorUserId,
          row.id,
          1,
        ),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(
        await client.b2bAuditEvent.count({ where: { entityId: row.id } }),
      ).toBe(2);
      await expect(
        signatories.remove(
          { ...scope, branchId: randomUUID() },
          row.id,
          2,
          actorUserId,
          'test delete',
        ),
      ).rejects.toThrow('یافت نشد');
      await expect(
        signatories.remove(scope, row.id, 1, actorUserId, 'test delete'),
      ).rejects.toThrow('هم‌زمان');
      await signatories.remove(scope, row.id, 2, actorUserId, 'test delete');
      expect(await signatories.find(scope, row.id)).toBeNull();
      expect(
        await client.masterOrganizationContact.findUnique({
          where: { id: contact.id },
        }),
      ).not.toBeNull();
      expect(
        await client.b2bAuditEvent.count({ where: { entityId: row.id } }),
      ).toBe(3);
    });
    it('rejects cross-organization contact/proofless activation and rolls back signatory writes when auditing fails', async () => {
      const signatories = new B2bSignatoryRepository({
        client,
      } as DatabaseService);
      const contact = await client.masterOrganizationContact.create({
        data: {
          organizationId,
          code: `SIGN-${randomUUID().slice(0, 20)}`,
          fullName: 'Synthetic scoped person',
          phoneEncrypted: 'synthetic-test-ciphertext',
          phoneEncryptionIv: 'test-iv',
          phoneEncryptionAuthTag: 'test-tag',
          phoneEncryptionKeyVersion: 1,
          phoneMasked: '09*****0000',
          phoneFingerprint: randomUUID(),
          createdByUserId: actorUserId,
          updatedByUserId: actorUserId,
        },
      });
      const scope = { organizationId, branchId };
      const values = {
        contactId: contact.id,
        documentTypes: ['FRAMEWORK_AGREEMENT'],
        authorityLimit: null,
        currencyCode: null,
        validFrom: new Date('2026-09-01T00:00:00Z'),
        validTo: null,
        documentVersionId: null,
        isActive: false,
        notes: '',
      };
      const before = await client.b2bOrganizationSignatory.count();
      await expect(
        signatories.save(
          { ...scope, organizationId: randomUUID() },
          values,
          actorUserId,
        ),
      ).rejects.toThrow();
      await expect(
        signatories.save(scope, { ...values, isActive: true }, actorUserId),
      ).rejects.toThrow();
      await expect(
        signatories.save(scope, values, randomUUID()),
      ).rejects.toThrow();
      expect(await client.b2bOrganizationSignatory.count()).toBe(before);
    });

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

    it('persists payment reference and expanded type, preserves legacy edits and enforces the FK', async () => {
      const { workflow, command } = await workflowFixture();
      const method = await client.masterPaymentMethod.create({
        data: {
          code: 'TEST_' + randomUUID().slice(0, 8).toUpperCase(),
          name: 'روش پرداخت آزمایشی',
          channel: 'BANK_TRANSFER',
          createdByUserId: actorUserId,
          updatedByUserId: actorUserId,
        },
      });
      const terms = {
        ...agreementTestTerms(),
        agreementType: 'HOTEL_SERVICES' as const,
        paymentMethodId: method.id,
        paymentMethodName: method.name,
      };
      let row = await workflow.save(command, terms);
      expect(row.revisions[0]!.paymentMethodId).toBe(method.id);
      expect(row.revisions[0]!.paymentMethodName).toBe(method.name);
      await expect(
        client.masterPaymentMethod.delete({ where: { id: method.id } }),
      ).rejects.toThrow();
      row = await workflow.save(
        {
          ...command,
          agreementId: row.id,
          version: row.version,
          requestId: randomUUID(),
        },
        agreementTestTerms(),
      );
      expect(row.revisions[0]!.paymentMethodId).toBe(method.id);
      await expect(
        workflow.save(
          {
            ...command,
            agreementId: row.id,
            version: row.version,
            requestId: randomUUID(),
          },
          { ...terms, paymentMethodId: randomUUID() },
        ),
      ).rejects.toThrow();
      expect((await workflow.find(command, row.id)).version).toBe(row.version);
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
    it('edits draft rates precisely, prevents stale or foreign deletes, and rolls back deletion when audit fails', async () => {
      const row = await repository.createRate({
        ...rate('RATE-CRUD'),
        isActive: false,
      });
      const write = {
        ...rate('RATE-CRUD'),
        id: row.id,
        expectedVersion: row.version,
        isActive: false,
        value: new Prisma.Decimal('7.1255'),
      };
      const updated = await repository.updateRate(write);
      expect(updated.value.toString()).toBe('7.1255');
      await expect(repository.updateRate(write)).rejects.toThrow('هم‌زمان');
      await expect(
        repository.updateRate({
          ...write,
          expectedVersion: updated.version,
          isActive: true,
        }),
      ).rejects.toThrow('هم‌پوشانی');
      const removal = {
        organizationId,
        branchId,
        id: row.id,
        expectedVersion: updated.version,
        actorUserId,
        reason: 'Synthetic removal',
      };
      await expect(
        repository.deleteRate({ ...removal, organizationId: randomUUID() }),
      ).rejects.toThrow('یافت نشد');
      await expect(
        repository.deleteRate({ ...removal, branchId: randomUUID() }),
      ).rejects.toThrow('یافت نشد');
      await expect(
        repository.deleteRate({ ...removal, expectedVersion: 1 }),
      ).rejects.toThrow('هم‌زمان');
      await expect(
        repository.deleteRate({ ...removal, actorUserId: randomUUID() }),
      ).rejects.toThrow();
      expect(
        await client.b2bAgencyAgreedRate.findUnique({ where: { id: row.id } }),
      ).not.toBeNull();
      await repository.deleteRate(removal);
      expect(
        await client.b2bAgencyAgreedRate.findUnique({ where: { id: row.id } }),
      ).toBeNull();
      const audit = await client.b2bAuditEvent.findFirstOrThrow({
        where: { entityId: row.id, action: 'b2b.rate.delete' },
      });
      expect(audit.beforeSnapshot).toMatchObject({
        value: '7.1255',
        version: 2,
      });
      expect(audit.afterSnapshot).toEqual({
        deleted: true,
        reason: removal.reason,
      });
    });
    it('creates, edits and permanently deletes an address through its owner with scope and audit atomicity', async () => {
      const directory = new MasterOrganizationDirectory({
        client,
      } as DatabaseService);
      const country = await client.masterCountry.findFirstOrThrow();
      const city = await client.masterCity.create({
        data: {
          countryId: country.id,
          code: 'DOSSIER-TEST',
          name: 'شهر آزمایشی',
          englishName: 'Synthetic city',
          createdByUserId: actorUserId,
          updatedByUserId: actorUserId,
        },
      });
      const actor: AuthenticatedActor = {
        userId: actorUserId,
        sessionId: randomUUID(),
        branchIds: [branchId],
        permissions: ['master_data.update', 'master_data.delete'],
      };
      const input = {
        countryId: country.id,
        cityId: city.id,
        label: 'شعبه آزمایشی',
        addressLine: 'نشانی ساختگی آزمون',
        isPrimary: true,
      };
      const row = await directory.createAddress(organizationId, input, actor);
      const edited = await directory.updateAddress(
        organizationId,
        row.id,
        { ...input, label: 'شعبه ویرایش‌شده', version: row.version },
        actor,
      );
      await expect(
        directory.deleteAddress(organizationId, row.id, edited.version, {
          ...actor,
          permissions: [],
        }),
      ).rejects.toThrow('مجوز');
      await expect(
        directory.deleteAddress(
          organizationId,
          row.id,
          edited.version,
          actor,
          randomUUID(),
        ),
      ).rejects.toThrow('شعبه');
      await expect(
        directory.deleteAddress(randomUUID(), row.id, edited.version, actor),
      ).rejects.toThrow('یافت نشد');
      await expect(
        directory.deleteAddress(organizationId, row.id, row.version, actor),
      ).rejects.toThrow('هم‌زمان');
      await client.$executeRawUnsafe(
        `CREATE FUNCTION address_test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='master_data.organization_address.delete' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`,
      );
      await client.$executeRawUnsafe(
        `CREATE TRIGGER address_test_fail_audit BEFORE INSERT ON master_audit_events FOR EACH ROW EXECUTE FUNCTION address_test_fail_audit()`,
      );
      try {
        await expect(
          directory.deleteAddress(
            organizationId,
            row.id,
            edited.version,
            actor,
          ),
        ).rejects.toThrow('synthetic audit failure');
      } finally {
        await client.$executeRawUnsafe(
          `DROP TRIGGER address_test_fail_audit ON master_audit_events`,
        );
        await client.$executeRawUnsafe(
          `DROP FUNCTION address_test_fail_audit()`,
        );
      }
      expect(
        (await directory.addresses(organizationId)).some(
          (address) => address.id === row.id,
        ),
      ).toBe(true);
      await directory.deleteAddress(
        organizationId,
        row.id,
        edited.version,
        actor,
      );
      expect(
        await client.masterOrganizationAddress.findUnique({
          where: { id: row.id },
        }),
      ).toBeNull();
      const audit = await client.masterDataAuditEvent.findFirstOrThrow({
        where: {
          entityId: row.id,
          action: 'master_data.organization_address.delete',
        },
      });
      expect(audit.beforeSnapshot).toMatchObject({ label: 'شعبه ویرایش‌شده' });
      expect(audit.beforeSnapshot).not.toHaveProperty('addressLine');
    });
  },
);
