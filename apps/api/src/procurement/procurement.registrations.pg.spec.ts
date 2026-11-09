import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import { savePettyFund } from './procurement.petty-cash';
import type { DocumentsService } from '../documents/documents.service';
import {
  registerPettyCash,
  listPettyRegistrations,
} from './procurement.registrations';

describe.skipIf(process.env.PROCUREMENT_REGISTRATIONS_DATABASE_TEST !== '1')(
  'Petty registrations PostgreSQL proof',
  () => {
    let database: DatabaseService;
    let actor: AuthenticatedActor;
    const detail = vi.fn();
    const documents = { detail } as unknown as DocumentsService;
    beforeAll(async () => {
      const target = new URL(process.env.DATABASE_URL ?? '');
      if (
        target.hostname !== '127.0.0.1' ||
        target.port !== '55593' ||
        target.pathname !== '/nora_ci'
      )
        throw new Error('Dedicated disposable database required');
      database = new DatabaseService();
      const user = await database.client.user.create({
        data: {
          username: `petty-test-${randomUUID()}`,
          displayName: 'Synthetic petty test',
          passwordHash: 'disabled-synthetic',
        },
      });
      actor = {
        userId: user.id,
        sessionId: randomUUID(),
        branchIds: [],
        permissions: [
          'procurement.read.all',
          'procurement.request.create',
          'documents.metadata.read',
          'documents.procurement.read',
        ],
      };
    });
    afterAll(async () => {
      await database?.onModuleDestroy();
    });
    async function fund(balance = '1000') {
      const branch = await database.client.branch.create({
        data: {
          code: `PET-${randomUUID().slice(0, 12)}`,
          name: 'Synthetic petty branch',
        },
      });
      const row = await database.client.procurementPettyFund.create({
        data: {
          branchId: branch.id,
          custodianId: actor.userId,
          currencyCode: 'IRR',
          balance,
        },
      });
      const reader = { ...actor, branchIds: [branch.id] };
      return {
        row,
        reader,
        input: {
          id: randomUUID(),
          branchId: branch.id,
          title: 'Synthetic registration',
          occurredAt: '2026-11-03T00:00:00.000Z',
          amount: '100.0001',
        },
      };
    }
    it('debits exact decimals once across simultaneous retries and rejects changed payloads', async () => {
      const { row, reader, input } = await fund();
      const results = await Promise.all([
        registerPettyCash(database, documents, input, reader),
        registerPettyCash(database, documents, input, reader),
      ]);
      expect(results[0]).toEqual(results[1]);
      expect(results[0]?.amount).toBe('100.0001');
      expect(
        (
          await database.client.procurementPettyFund.findUniqueOrThrow({
            where: { id: row.id },
          })
        ).balance.toString(),
      ).toBe('899.9999');
      expect(
        await database.client.procurementPettyEntry.count({
          where: { fundId: row.id },
        }),
      ).toBe(1);
      await expect(
        registerPettyCash(
          database,
          documents,
          { ...input, title: 'Changed' },
          reader,
        ),
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      await expect(
        database.client.procurementPettyEntry.update({
          where: { id: input.id },
          data: { title: 'Tampered' },
        }),
      ).rejects.toThrow();
    });
    it('never overdraws competing registrations', async () => {
      const { row, reader, input } = await fund('100');
      const results = await Promise.allSettled([
        registerPettyCash(
          database,
          documents,
          { ...input, amount: '70' },
          reader,
        ),
        registerPettyCash(
          database,
          documents,
          { ...input, id: randomUUID(), amount: '70' },
          reader,
        ),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        (
          await database.client.procurementPettyFund.findUniqueOrThrow({
            where: { id: row.id },
          })
        ).balance.toString(),
      ).toBe('30');
      expect(
        await database.client.procurementPettyEntry.count({
          where: { fundId: row.id },
        }),
      ).toBe(1);
    });
    it('denies foreign branches, noncustodians and nonpositive amounts without a movement', async () => {
      const { row, reader, input } = await fund();
      await expect(
        registerPettyCash(database, documents, input, {
          ...reader,
          branchIds: [],
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        registerPettyCash(database, documents, input, {
          ...reader,
          userId: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      for (const amount of ['0', '-1', '1.00001'])
        await expect(
          registerPettyCash(database, documents, { ...input, amount }, reader),
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(
        await database.client.procurementPettyEntry.count({
          where: { fundId: row.id },
        }),
      ).toBe(0);
    });
    it('rolls balance back if the receipt foreign key disappears and rejects cross-branch receipts', async () => {
      const { row, reader, input } = await fund();
      const receipt = { id: randomUUID(), versionId: randomUUID() };
      detail.mockResolvedValue({
        data: {
          branchId: row.branchId,
          type: { domain: 'PROCUREMENT' },
          archiveStatus: 'ACTIVE',
          versions: [
            { id: receipt.versionId, scanStatus: 'AWAITING_ANTIVIRUS_ADAPTER' },
          ],
        },
      });
      await expect(
        registerPettyCash(database, documents, { ...input, receipt }, reader),
      ).rejects.toThrow();
      expect(
        (
          await database.client.procurementPettyFund.findUniqueOrThrow({
            where: { id: row.id },
          })
        ).balance.toString(),
      ).toBe('1000');
      detail.mockResolvedValue({
        data: {
          branchId: randomUUID(),
          type: { domain: 'PROCUREMENT' },
          archiveStatus: 'ACTIVE',
          versions: [{ id: receipt.versionId, scanStatus: 'CLEAN' }],
        },
      });
      await expect(
        registerPettyCash(database, documents, { ...input, receipt }, reader),
      ).rejects.toMatchObject({ code: 'INVALID_DOCUMENT' });
    });
    it('persists the receipt document/version with the debit in the same immutable record', async () => {
      const { row, reader, input } = await fund();
      const type = await database.client.documentType.create({
        data: {
          code: `PET-${randomUUID()}`,
          name: 'Synthetic receipt type',
          domain: 'PROCUREMENT',
          allowedMimeTypes: ['application/pdf'],
        },
      });
      const doc = await database.client.document.create({
        data: {
          title: 'Synthetic receipt',
          documentTypeId: type.id,
          branchId: row.branchId,
          ownerUserId: actor.userId,
          sourceModule: 'PROCUREMENT',
          createdByUserId: actor.userId,
          updatedByUserId: actor.userId,
        },
      });
      const version = await database.client.documentVersion.create({
        data: {
          documentId: doc.id,
          versionNumber: 1,
          storageObjectKey: `synthetic/${randomUUID()}`,
          originalFileName: 'receipt.pdf',
          safeDownloadName: 'receipt.pdf',
          detectedMimeType: 'application/pdf',
          extension: 'pdf',
          sizeBytes: 8n,
          sha256: 'a'.repeat(64),
          versionNote: 'Synthetic',
          createdByUserId: actor.userId,
        },
      });
      detail.mockResolvedValue({
        data: {
          branchId: row.branchId,
          type: { domain: 'PROCUREMENT' },
          archiveStatus: 'ACTIVE',
          versions: [{ id: version.id, scanStatus: 'PENDING_SCAN' }],
        },
      });
      const result = await registerPettyCash(
        database,
        documents,
        { ...input, receipt: { id: doc.id, versionId: version.id } },
        reader,
      );
      expect(result).toMatchObject({
        receiptDocumentId: doc.id,
        receiptVersionId: version.id,
      });
      const persisted =
        await database.client.procurementPettyEntry.findUniqueOrThrow({
          where: { id: input.id },
        });
      expect(persisted.receiptVersionId).toBe(version.id);
      expect(persisted.amount.toString()).toBe('-100.0001');
      const manager = {
        ...reader,
        permissions: [...reader.permissions, 'procurement.assign' as const],
      };
      const updated =
        await database.client.procurementPettyFund.findUniqueOrThrow({
          where: { id: row.id },
        });
      await database.client.$transaction((tx) =>
        savePettyFund(
          tx,
          {
            branchId: row.branchId,
            version: updated.version,
            balance: '1200',
            currencyCode: 'IRR',
          },
          manager,
          { receiptDocumentId: doc.id, receiptVersionId: version.id },
        ),
      );
      const credit =
        await database.client.procurementPettyEntry.findFirstOrThrow({
          where: { fundId: row.id, title: null, receiptDocumentId: doc.id },
        });
      expect(credit.amount.toString()).toBe('300.0001');
      const fresh =
        await database.client.procurementPettyFund.findUniqueOrThrow({
          where: { id: row.id },
        });
      await expect(
        database.client.$transaction((tx) =>
          savePettyFund(
            tx,
            {
              branchId: row.branchId,
              version: fresh.version,
              balance: '1000',
              currencyCode: 'IRR',
            },
            manager,
            { receiptDocumentId: doc.id, receiptVersionId: version.id },
          ),
        ),
      ).rejects.toThrow();
      expect(
        (
          await database.client.procurementPettyFund.findUniqueOrThrow({
            where: { id: row.id },
          })
        ).balance.toString(),
      ).toBe('1200');
    });
    it('stores inclusive commission and metadata without a second debit, and rejects changed retries', async () => {
      const { row, reader, input } = await fund();
      const body = {
        ...input,
        amount: '100',
        fee: '12.5000',
        costCenter: 'Operations',
        description: 'Receipt details',
      };
      expect(
        await registerPettyCash(database, documents, body, reader),
      ).toMatchObject({
        amount: '100',
        fee: '12.5',
        costCenter: 'Operations',
        description: 'Receipt details',
      });
      await registerPettyCash(database, documents, body, reader);
      expect(
        (
          await database.client.procurementPettyFund.findUniqueOrThrow({
            where: { id: row.id },
          })
        ).balance.toString(),
      ).toBe('900');
      for (const change of [
        { fee: '13' },
        { costCenter: 'Other' },
        { description: 'Changed' },
      ])
        await expect(
          registerPettyCash(
            database,
            documents,
            { ...body, ...change },
            reader,
          ),
        ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      for (const fee of ['101', '-1'])
        await expect(
          registerPettyCash(
            database,
            documents,
            { ...body, id: randomUUID(), fee },
            reader,
          ),
        ).rejects.toThrow();
    });

    it('hides reversed mission registrations while preserving the ledger entry', async () => {
      const { row, reader, input } = await fund();
      await registerPettyCash(database, documents, input, reader);
      const entry =
        await database.client.procurementPettyEntry.findUniqueOrThrow({
          where: { id: input.id },
        });
      await database.client.procurementPettyEntry.create({
        data: {
          fundId: row.id,
          actorId: actor.userId,
          requestKey: entry.id,
          amount: entry.amount.negated(),
        },
      });
      const page = await listPettyRegistrations(
        database,
        { branchId: row.branchId },
        reader,
      );
      expect(page.items).toEqual([]);
      expect(page.hasMore).toBe(false);
      expect(
        await database.client.procurementPettyEntry.findUnique({
          where: { id: input.id },
        }),
      ).toMatchObject({ title: input.title });
    });

    it('lists persisted registrations by title/date/branch without adjustment rows', async () => {
      const { row, reader, input } = await fund();
      await registerPettyCash(database, documents, input, reader);
      await database.client.procurementPettyEntry.create({
        data: { fundId: row.id, actorId: actor.userId, amount: '0' },
      });
      expect(
        (
          await listPettyRegistrations(
            database,
            {
              branchId: row.branchId,
              search: 'registration',
              from: '2026-11-03',
              to: '2026-11-03',
            },
            reader,
          )
        ).items.map((item) => item.id),
      ).toEqual([input.id]);
      expect(
        (
          await listPettyRegistrations(
            database,
            { branchId: row.branchId, from: '2026-11-04' },
            reader,
          )
        ).items,
      ).toEqual([]);
      expect(
        (
          await listPettyRegistrations(
            database,
            {},
            { ...reader, branchIds: [] },
          )
        ).items,
      ).toEqual([]);
      expect(
        (
          await listPettyRegistrations(
            database,
            { branchId: row.branchId },
            {
              ...reader,
              userId: randomUUID(),
              permissions: ['procurement.read.own'],
            },
          )
        ).items,
      ).toEqual([]);
      await expect(
        listPettyRegistrations(database, { branchId: randomUUID() }, reader),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  },
);
