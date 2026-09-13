import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AuthenticatedActor } from '@rubi/contracts';
import { DatabaseService } from '../database/database.service';
import type { DocumentsService } from '../documents/documents.service';
import type { IamProcurementDirectory } from '../iam/iam-procurement-directory';
import type { LegalEntitiesService } from '../legal-entities/legal-entities.service';
import { ProcurementExports } from './procurement.exports';
import { PROCUREMENT_XLSX_MIME } from './procurement.rendering';
import type { ProcurementService } from './procurement.service';

describe.skipIf(process.env.PROCUREMENT_API_DATABASE_TEST !== '1')(
  'Durable Procurement export queue',
  () => {
    let database: DatabaseService;
    let exports: ProcurementExports;
    let actor: AuthenticatedActor;
    let activeActor: AuthenticatedActor | null;
    let allIssuer = false;
    let uploadCount = 0;
    const archived = new Map<
      string,
      { id: string; versions: { id: string; scanStatus: string }[] }
    >();
    const typeId = randomUUID();
    const categoryId = randomUUID();
    beforeAll(async () => {
      const target = new URL(process.env.DATABASE_URL ?? '');
      if (
        target.hostname !== '127.0.0.1' ||
        target.port !== '55473' ||
        target.pathname !== '/procurement_001_api_test'
      )
        throw new Error('Refusing a non-task test database');
      database = new DatabaseService();
      const branch = await database.client.branch.create({
        data: {
          code: `PE-${randomUUID().slice(0, 12)}`,
          name: 'Synthetic export branch',
        },
      });
      const user = await database.client.user.create({
        data: {
          username: `pex-${randomUUID()}`,
          displayName: 'Synthetic export operator',
          passwordHash: 'disabled-synthetic-fixture',
        },
      });
      actor = {
        userId: user.id,
        sessionId: randomUUID(),
        branchIds: [branch.id],
        permissions: [
          'procurement.read.own',
          'procurement.export',
          'documents.upload',
          'documents.list',
          'documents.metadata.read',
          'documents.procurement.read',
        ],
      };
      const documents = {
        options: async () => ({
          data: {
            documentTypes: [
              {
                id: typeId,
                domain: 'PROCUREMENT',
                allowedMimeTypes: [PROCUREMENT_XLSX_MIME, 'application/pdf'],
                requiresExpiry: false,
              },
            ],
            categories: [{ id: categoryId }],
          },
        }),
        list: async (query: { sourceEntityId: string }) => {
          const row = archived.get(query.sourceEntityId);
          return { data: row ? [row] : [], meta: { total: row ? 1 : 0 } };
        },
        detail: async (id: string) => ({
          data: [...archived.values()].find((row) => row.id === id),
        }),
        upload: async (
          input: { sourceEntityId: string },
          file: { buffer: Buffer },
        ) => {
          expect(file.buffer.subarray(0, 2).toString()).toBe('PK');
          uploadCount++;
          const row = {
            id: randomUUID(),
            versions: [{ id: randomUUID(), scanStatus: 'PENDING' }],
          };
          archived.set(input.sourceEntityId, row);
          return { data: row };
        },
      } as unknown as DocumentsService;
      const procurement = {
        list: async (_query: unknown, scoped: AuthenticatedActor) => {
          expect(scoped.branchIds).toEqual(actor.branchIds);
          return { items: [], hasMore: false };
        },
      } as unknown as ProcurementService;
      const iam = {
        actorForSession: async () => activeActor,
      } as unknown as IamProcurementDirectory;
      const legal = {
        issueTargets: async () => ({
          data: {
            requiresExplicitIssuer: allIssuer,
            targets: allIssuer ? [] : [{ id: randomUUID() }],
          },
        }),
        branding: async () => ({
          data: { persianName: 'Synthetic issuer', version: 1 },
        }),
      } as unknown as LegalEntitiesService;
      exports = new ProcurementExports(
        database,
        procurement,
        iam,
        documents,
        legal,
      );
    }, 60000);
    beforeEach(() => {
      activeActor = actor;
      allIssuer = false;
    });
    afterAll(async () => {
      await database?.onModuleDestroy();
    });
    const input = (format = 'XLSX') => ({
      kind: 'REQUESTS',
      format,
      branchId: actor.branchIds[0],
      documentTypeId: typeId,
      categoryId,
      query: {},
    });
    it('serializes duplicate jobs and recovers an already-archived file without a second upload', async () => {
      const key = randomUUID();
      const before = uploadCount;
      const [first, retry] = await Promise.all([
        exports.create(input(), key, actor),
        exports.create(input(), key, actor),
      ]);
      expect(retry.id).toBe(first.id);
      await Promise.all([exports.tick(), exports.tick()]);
      expect((await exports.detail(first.id, actor)).status).toBe('COMPLETED');
      expect(uploadCount).toBe(before + 1);
      await database.client.procurementExportJob.update({
        where: { id: first.id },
        data: {
          status: 'RUNNING',
          leaseUntil: new Date(0),
          version: { increment: 1 },
        },
      });
      await exports.tick();
      expect((await exports.detail(first.id, actor)).status).toBe('COMPLETED');
      expect(uploadCount).toBe(before + 1);
    }, 60000);
    it('rechecks current authority before a queued upload and rejects key reuse with changed input', async () => {
      const key = randomUUID();
      const before = uploadCount;
      const job = await exports.create(input(), key, actor);
      await expect(
        exports.create({ ...input(), query: { status: 'DRAFT' } }, key, actor),
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      activeActor = { ...actor, permissions: ['procurement.read.own'] };
      await exports.tick();
      expect(await exports.detail(job.id, actor)).toMatchObject({
        status: 'FAILED',
        errorCode: 'FORBIDDEN',
      });
      expect(uploadCount).toBe(before);
    }, 60000);
    it('rejects ALL issuer PDF and an expired queued session without generating a file', async () => {
      allIssuer = true;
      await expect(
        exports.create(input('PDF'), randomUUID(), actor),
      ).rejects.toMatchObject({ code: 'ISSUER_REQUIRED' });
      const job = await exports.create(input(), randomUUID(), actor);
      const before = uploadCount;
      activeActor = null;
      await exports.tick();
      expect(await exports.detail(job.id, actor)).toMatchObject({
        status: 'FAILED',
        errorCode: 'EXPORT_SESSION_EXPIRED',
      });
      expect(uploadCount).toBe(before);
    }, 60000);
  },
);
