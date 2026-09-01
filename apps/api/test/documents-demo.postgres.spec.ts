import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseEnv } from 'node:util';

import { ConfigService } from '@nestjs/config';
import type { AuthenticatedActor } from '@rubi/contracts';
import { createDatabaseClient, type DatabaseClient } from '@rubi/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { DatabaseService } from '../src/database/database.service';
import { documentDemoFixtures } from '../src/documents/demo/document-demo-fixtures';
import {
  seedLocalDocumentsDemo,
  type DocumentsDemoAntivirus,
} from '../src/documents/demo/local-document-demo';
import { DocumentsRepository } from '../src/documents/documents.repository';
import type { DocumentsScanProcessor } from '../src/documents/documents.scan-processor';
import { DocumentsService } from '../src/documents/documents.service';
import { LocalDocumentStorage } from '../src/documents/documents.storage';

const databaseName = `rubi_documents_demo_test_${randomUUID().replaceAll('-', '')}`;
const encryptionKey = randomBytes(32).toString('base64');
const username = 'documents-demo-admin';
const branchId = 'd003ca00-0000-4000-8000-000000000001';
const userId = 'd003ca00-0000-4000-8000-000000000002';
const roleId = 'd003ca00-0000-4000-8000-000000000003';
let databaseUrl = '';
let storageRoot = '';
let client: DatabaseClient;
let storage: LocalDocumentStorage;
let createdDatabase = false;

const antivirus: DocumentsDemoAntivirus = {
  available: true,
  async scan() {
    return {
      status: 'CLEAN',
      adapterReference: 'isolated-test-antivirus',
      scannedAt: new Date('2026-09-01T10:30:00.000Z'),
      engineVersion: 'Isolated Test Antivirus',
      threatCode: null,
    };
  },
};

function sql(database: string, input: string) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'rubi-postgres-1',
      'psql',
      '-U',
      'rubi_local',
      '-d',
      database,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input, encoding: 'utf8', stdio: 'pipe', timeout: 60_000 },
  );
}

function run(
  apply: boolean,
  selectedAntivirus: DocumentsDemoAntivirus = antivirus,
) {
  return seedLocalDocumentsDemo({
    databaseUrl,
    environment: 'test',
    storageRoot,
    storageEncryptionKeyBase64: encryptionKey,
    antivirusMode: 'disabled',
    username,
    apply,
    now: new Date('2026-09-01T10:00:00.000Z'),
    antivirus: selectedAntivirus,
    storage,
  });
}

describe.skipIf(process.env.RUBI_RUN_DOCUMENTS_DEMO_POSTGRES_TESTS !== '1')(
  'Documents demo on isolated PostgreSQL and encrypted local storage',
  () => {
    beforeAll(async () => {
      const envFile =
        process.env.RUBI_DEMO_TEST_ENV_FILE ?? resolve(process.cwd(), '.env');
      const local = parseEnv(readFileSync(envFile, 'utf8'));
      const url = new URL(local.DATABASE_URL!);
      if (
        !['localhost', '127.0.0.1'].includes(url.hostname) ||
        url.port !== '55432' ||
        !/^rubi_documents_demo_test_[a-f0-9]{32}$/.test(databaseName)
      ) {
        throw new Error('Invalid local Documents demo test target.');
      }
      sql('postgres', `CREATE DATABASE "${databaseName}";`);
      createdDatabase = true;
      const migrations = resolve(
        process.cwd(),
        '../../packages/database/prisma/migrations',
      );
      const files = readdirSync(migrations, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .sort((left, right) => left.name.localeCompare(right.name));
      sql(
        databaseName,
        files
          .map((entry) =>
            readFileSync(
              resolve(migrations, entry.name, 'migration.sql'),
              'utf8',
            ),
          )
          .join('\n'),
      );
      url.pathname = `/${databaseName}`;
      databaseUrl = url.toString();
      client = createDatabaseClient(databaseUrl);
      storageRoot = await mkdtemp(join(tmpdir(), 'rubi-documents-demo-test-'));
      storage = new LocalDocumentStorage(
        new ConfigService({
          DOCUMENTS_STORAGE_ROOT: storageRoot,
          DOCUMENTS_STORAGE_ENCRYPTION_KEY_BASE64: encryptionKey,
        }),
      );
      await client.branch.create({
        data: { id: branchId, code: 'DOC-DEMO', name: 'شعبه آزمایشی اسناد' },
      });
      await client.role.create({
        data: {
          id: roleId,
          code: 'administrator',
          name: 'مدیر آزمایشی',
          isSystem: true,
        },
      });
      await client.user.create({
        data: {
          id: userId,
          username,
          displayName: 'مدیر آزمایشی اسناد',
          passwordHash: '$argon2id$synthetic-test-only',
        },
      });
      await client.userRole.create({ data: { userId, roleId } });
      await client.userBranch.create({
        data: { userId, branchId, isPrimary: true },
      });
      const fixtureTypes = new Map([
        ['PASSPORT', ['CUSTOMER_IDENTITY', true]],
        ['CUSTOMER_DOCUMENT', ['CUSTOMER_IDENTITY', false]],
        ['QUOTATION', ['SALES', true]],
        ['CONTRACT', ['SALES', true]],
        ['VOUCHER', ['TRAVEL', true]],
        ['PROCUREMENT_DOCUMENT', ['PROCUREMENT', false]],
        ['HR_DOCUMENT', ['HUMAN_RESOURCES', true]],
      ] as const);
      for (const [code, [domain, requiresExpiry]] of fixtureTypes) {
        await client.documentType.create({
          data: {
            code,
            name: `${code} آزمایشی`,
            domain,
            defaultConfidentiality: 'INTERNAL',
            allowedMimeTypes: ['image/png'],
            maxFileSizeBytes: BigInt(25 * 1024 * 1024),
            requiresExpiry,
          },
        });
      }
      for (const code of [
        'CUSTOMER_IDENTITY',
        'SALES_CONTRACTS',
        'TRAVEL_RESERVATIONS',
        'PROCUREMENT_FINANCE',
        'ORGANIZATION_HR',
      ]) {
        await client.documentCategory.create({
          data: { code, name: `${code} آزمایشی` },
        });
      }
    }, 120_000);

    afterAll(async () => {
      if (client) await client.$disconnect();
      if (storageRoot && existsSync(storageRoot)) {
        await rm(storageRoot, { recursive: true, force: true });
      }
      if (
        createdDatabase &&
        /^rubi_documents_demo_test_[a-f0-9]{32}$/.test(databaseName)
      ) {
        sql('postgres', `DROP DATABASE "${databaseName}" WITH (FORCE);`);
      }
    });

    it('previews all records without writing database or storage', async () => {
      const report = await run(false);
      expect(report).toMatchObject({
        applied: false,
        created: 7,
        reused: 0,
        repairedFiles: 0,
      });
      expect(await client.document.count()).toBe(0);
      expect(readdirSync(storageRoot)).toEqual([]);
    });

    it('fails closed before writing when antivirus is unavailable', async () => {
      await expect(
        run(true, {
          available: false,
          scan: async () => {
            throw new Error('must not scan');
          },
        }),
      ).rejects.toThrow('requires an available local antivirus');
      expect(await client.document.count()).toBe(0);
      expect(readdirSync(storageRoot)).toEqual([]);
    });

    it('applies once with CLEAN scans and encrypted files, then reuses without duplicates', async () => {
      const first = await run(true);
      expect(first).toMatchObject({
        applied: true,
        created: 7,
        reused: 0,
        repairedFiles: 0,
      });
      expect(
        await client.documentVersion.count({ where: { scanStatus: 'CLEAN' } }),
      ).toBe(7);
      expect(
        await client.documentQuarantine.count({
          where: { status: 'RELEASED' },
        }),
      ).toBe(7);
      expect(
        await client.documentProcessingJob.count({
          where: { status: 'COMPLETED' },
        }),
      ).toBe(7);
      const fixtures = documentDemoFixtures(
        new Date('2026-09-01T10:00:00.000Z'),
      );
      for (const fixture of fixtures) {
        const contents = await storage.readQuarantined(
          `documents/${fixture.documentId}/v1/${fixture.storageFileId}.bin`,
          fixture.contents.length,
        );
        expect(contents).toEqual(fixture.contents);
      }
      const audit = await client.documentAuditEvent.findMany();
      expect(audit).toHaveLength(14);
      expect(JSON.stringify(audit)).not.toMatch(
        /(?:password|token|secret|passportNumber|nationalId|cvv)/i,
      );

      const second = await run(true);
      expect(second).toMatchObject({ created: 0, reused: 7 });
      expect(await client.document.count()).toBe(7);
      expect(await client.documentVersion.count()).toBe(7);
      expect(await client.documentAuditEvent.count()).toBe(14);
    }, 180_000);

    it('preserves user-edited metadata and exposes previewable rows through the real service', async () => {
      const first = documentDemoFixtures(
        new Date('2026-09-01T10:00:00.000Z'),
      )[0]!;
      await client.document.update({
        where: { id: first.documentId },
        data: { title: 'عنوان ویرایش‌شده کاربر' },
      });
      expect((await run(true)).reused).toBe(7);
      expect(
        (await client.document.findUnique({ where: { id: first.documentId } }))
          ?.title,
      ).toBe('عنوان ویرایش‌شده کاربر');

      const repository = new DocumentsRepository({ client } as DatabaseService);
      const service = new DocumentsService(repository, storage, {
        available: true,
      } as DocumentsScanProcessor);
      const actor: AuthenticatedActor = {
        userId,
        sessionId: userId,
        branchIds: [branchId],
        permissions: [
          'documents.list',
          'documents.metadata.read',
          'documents.file.read',
          'documents.download',
          'documents.sensitive.read',
          'documents.sensitive.download',
          'documents.customer_identity.read',
          'documents.sales.read',
          'documents.travel.read',
          'documents.procurement.read',
          'documents.hr.read',
        ],
      };
      const list = await service.list(
        {
          page: 1,
          pageSize: 25,
          sortBy: 'updatedAt',
          sortDirection: 'desc',
        },
        actor,
      );
      expect(list.meta.total).toBe(7);
      const internal = list.data.find(
        (row) =>
          row.confidentiality === 'INTERNAL' &&
          row.currentVersion.scanStatus === 'CLEAN',
      )!;
      const preview = await service.preview(internal.id, actor, {});
      const chunks: Buffer[] = [];
      for await (const chunk of preview.stream) chunks.push(Buffer.from(chunk));
      expect(Buffer.concat(chunks).subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
    }, 120_000);
  },
);
