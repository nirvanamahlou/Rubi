import {
  accountingTestUrl,
  assertAccountingTestDatabase,
} from './accounting-test-database';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { AccountingService } from '../src/finance/accounting/accounting.service';
import { syncStandardEntities } from '../src/finance/accounting/accounting-standard-ledger';

const url = accountingTestUrl('ACCOUNTING_COMPLETION_TEST_DATABASE_URL');
describe.skipIf(!url)(
  'standard catalogues and mappings on isolated PostgreSQL',
  () => {
    let db: DatabaseClient,
      service: AccountingService,
      bookId: string,
      otherBookId: string,
      groupId: string,
      generalId: string,
      debitId: string,
      creditId: string,
      foreignId: string,
      standardId: string,
      periodId: string;
    const branchId = randomUUID(),
      userId = randomUUID(),
      checkerId = randomUUID();
    const actor: AuthenticatedActor = {
      userId,
      sessionId: randomUUID(),
      branchIds: [branchId],
      permissions: [
        'finance.read',
        'finance.journal.read',
        'finance.account.manage',
      ],
    };
    const command = <T = Record<string, unknown>>(
      action: string,
      payload: Record<string, unknown>,
      expectedVersion?: number,
      key = randomUUID(),
      who = actor,
    ) =>
      service.command(
        bookId,
        action,
        { key, payload, expectedVersion },
        who,
      ) as Promise<T>;
    const entities = () =>
      db.accountingStandardEntity.findMany({
        where: { standardId },
        orderBy: { systemEntity: 'asc' },
        include: { codes: true },
      });
    beforeAll(async () => {
      assertAccountingTestDatabase(url!, '55442', 'rubi_completion_test');
      db = createDatabaseClient(url);
      await db.branch.create({
        data: {
          id: branchId,
          code: branchId,
          name: 'Synthetic standard branch',
        },
      });
      await db.user.create({
        data: {
          id: userId,
          username: userId,
          displayName: 'Synthetic',
          passwordHash: 'not-a-login-credential',
        },
      });
      await db.user.create({
        data: {
          id: checkerId,
          username: checkerId,
          displayName: 'Synthetic checker',
          passwordHash: 'not-a-login-credential',
        },
      });
      service = new AccountingService(
        { client: db } as never,
        {
          branches: async () => [{ id: branchId }],
          displayNames: async () => [{ id: userId, displayName: 'Synthetic' }],
        } as never,
      );
      bookId = (
        await service.createBook(
          {
            id: randomUUID(),
            branchId,
            code: 'STD',
            title: 'Synthetic standards',
            baseCurrency: 'IRR',
            approvalPolicy: 'DUAL_CONTROL',
          },
          actor,
        )
      ).id;
      otherBookId = (
        await db.accountingBook.create({
          data: {
            branchId,
            code: 'OTHER',
            title: 'Synthetic other book',
            baseCurrency: 'IRR',
          },
        })
      ).id;
      const account = async (
        code: string,
        level: string,
        parentId?: string,
        owner = bookId,
      ) =>
        (
          await db.accountingAccount.create({
            data: {
              bookId: owner,
              code,
              title: 'Synthetic ' + code,
              level,
              nature: 'DEBIT',
              attributes: {},
              ...(parentId ? { parentId } : {}),
            },
          })
        ).id;
      groupId = await account('01', 'GROUP');
      generalId = await account('0101', 'GENERAL', groupId);
      debitId = await account('0101001', 'SUBSIDIARY', generalId);
      creditId = await account('0101002', 'SUBSIDIARY', generalId);
      foreignId = await account('0099', 'SUBSIDIARY', undefined, otherBookId);
      const year = await db.accountingConfiguration.create({
        data: {
          bookId,
          kind: 'fiscal-years',
          code: '2026',
          title: 'Synthetic',
          attributes: {},
        },
      });
      periodId = (
        await db.accountingPeriod.create({
          data: {
            bookId,
            fiscalYearId: year.id,
            startDate: '2026-01-01',
            endDate: '2026-12-31',
          },
        })
      ).id;
      const type = await db.accountingConfiguration.create({
        data: {
          bookId,
          kind: 'voucher-types',
          code: '01',
          title: 'Synthetic',
          attributes: {},
        },
      });
      for (const status of ['POSTED', 'DRAFT']) {
        const journal = await db.accountingJournal.create({
          data: {
            bookId,
            periodId,
            typeId: type.id,
            makerId: userId,
            status: 'DRAFT',
            documentDate: '2026-03-01',
            description: 'Synthetic only',
            attributes: {},
            lines: {
              create: [
                {
                  position: 1,
                  accountId: debitId,
                  debit: '999999999999999999.123456789123456789',
                  credit: '0',
                  attributes: {},
                },
                {
                  position: 2,
                  accountId: creditId,
                  debit: '0',
                  credit: '999999999999999999.123456789123456789',
                  attributes: {},
                },
              ],
            },
          },
        });
        if (status === 'POSTED')
          await db.accountingJournal.update({
            where: { id: journal.id },
            data: {
              status,
              approverId: checkerId,
              number: 1,
              postedAt: new Date(),
            },
          });
      }
      const source = await db.accountingConfiguration.findFirstOrThrow({
        where: { bookId, code: 'SYS-SANA-1.01' },
      });
      const copy = await command<{ id: string }>('save-configuration', {
        kind: 'coding-standards',
        title: 'Synthetic SANA copy',
        copySourceId: source.id,
        copySourceVersion: source.version,
        attributes: {
          ...Object.fromEntries(
            Object.entries(source.attributes as object).filter(
              ([key]) => !['protocolTitle', 'catalogRevision'].includes(key),
            ),
          ),
          isSystem: false,
        },
      });
      standardId = copy.id;
    }, 30000);
    afterAll(async () => {
      await db?.$disconnect();
    });

    it('loads all observed current catalogues and copies codes without copying operational mappings', async () => {
      const configs = await db.accountingConfiguration.findMany({
        where: { bookId, kind: 'coding-standards' },
        include: {
          standardEntities: {
            include: { _count: { select: { codes: true, mappings: true } } },
          },
        },
      });
      expect(
        configs.filter(
          (row) => (row.attributes as { isSystem?: boolean }).isSystem,
        ),
      ).toHaveLength(3);
      expect(
        configs.find((row) => row.code === 'SYS-SANAMA-3.1')
          ?.standardEntities[0]?._count.codes,
      ).toBe(279);
      expect(
        configs.find((row) => row.code === 'SYS-SAMAD-1.1')?.standardEntities[0]
          ?._count.codes,
      ).toBe(101);
      const source = configs.find((row) => row.code === 'SYS-SANA-1.01')!,
        copy = configs.find((row) => row.id === standardId)!;
      expect(copy.standardEntities.map((row) => row.rowId).sort()).toEqual(
        source.standardEntities.map((row) => row.rowId).sort(),
      );
      expect(copy.standardEntities.map((row) => row.id)).not.toEqual(
        source.standardEntities.map((row) => row.id),
      );
      expect(
        copy.standardEntities.reduce((n, row) => n + row._count.codes, 0),
      ).toBe(
        source.standardEntities.reduce((n, row) => n + row._count.codes, 0),
      );
      expect(
        copy.standardEntities.every((row) => row._count.mappings === 0),
      ).toBe(true);
      const entity = source.standardEntities[0]!;
      await expect(
        command(
          'standard-code-save',
          { entityId: entity.id, code: '009', title: 'Cannot change stock' },
          entity.version,
        ),
      ).rejects.toThrow();
    });
    it('rejects foreign-book, wrong-level and unauthorized maps atomically', async () => {
      const entity = (await entities()).find(
        (row) => row.systemEntity === 'حساب معین',
      )!;
      const payload = {
        entityId: entity.id,
        codeId: entity.codes[0]!.id,
        accountIds: [debitId, foreignId],
      };
      await expect(
        command('standard-map', payload, entity.version),
      ).rejects.toThrow();
      await expect(
        command(
          'standard-map',
          { ...payload, accountIds: [generalId] },
          entity.version,
        ),
      ).rejects.toThrow();
      await expect(
        command(
          'standard-map',
          { ...payload, accountIds: [debitId] },
          entity.version,
          randomUUID(),
          { ...actor, permissions: ['finance.read', 'finance.journal.read'] },
        ),
      ).rejects.toThrow();
      expect(
        await db.accountingStandardMapping.count({
          where: { entityId: entity.id },
        }),
      ).toBe(0);
      await expect(
        db.accountingStandardMapping.create({
          data: {
            bookId,
            entityId: entity.id,
            codeId: entity.codes[0]!.id,
            accountId: foreignId,
          },
        }),
      ).rejects.toThrow();
    });
    it('serializes versions, replays one command and records both map and unmap snapshots', async () => {
      const entity = (await entities()).find(
          (row) => row.systemEntity === 'حساب معین',
        )!,
        code = entity.codes[0]!,
        key = randomUUID();
      const payload = {
        entityId: entity.id,
        codeId: code.id,
        accountIds: [debitId],
      };
      const first = await command('standard-map', payload, entity.version, key);
      expect(
        await command('standard-map', payload, entity.version, key),
      ).toEqual(first);
      await expect(
        command(
          'standard-map',
          { ...payload, accountIds: [creditId] },
          entity.version,
        ),
      ).rejects.toThrow();
      const current = await db.accountingStandardEntity.findUniqueOrThrow({
        where: { id: entity.id },
      });
      await expect(
        command('standard-map', payload, current.version),
      ).rejects.toThrow();
      const result = await command('standard-unmap', payload, current.version);
      expect(result).toMatchObject({
        action: 'standard-unmap',
        changes: { accounts: [{ id: debitId, code: '0101001' }] },
      });
      expect(
        await db.accountingCommand.count({
          where: { bookId, action: 'standard-map' },
        }),
      ).toBe(1);
      expect(
        await db.accountingStandardMapping.count({
          where: { entityId: entity.id },
        }),
      ).toBe(0);
    });
    it('preserves leading zeros, prevents referenced entity deletion and reports each posted amount once across three levels', async () => {
      for (const entity of await entities()) {
        const code = await command(
          'standard-code-save',
          {
            entityId: entity.id,
            code: '00025',
            title: 'Synthetic mapped code',
          },
          entity.version,
        );
        const current = await db.accountingStandardEntity.findUniqueOrThrow({
          where: { id: entity.id },
          include: { codes: true },
        });
        expect(code).toMatchObject({ changes: { code: '00025' } });
        await command(
          'standard-map',
          {
            entityId: entity.id,
            codeId: current.codes.find((row) => row.code === '00025')!.id,
            accountIds:
              entity.systemEntity === 'گروه حساب'
                ? [groupId]
                : entity.systemEntity === 'حساب کل'
                  ? [generalId]
                  : [debitId, creditId],
          },
          current.version,
        );
      }
      const report = (await service.analyticalReport(
        bookId,
        'standard-turnover',
        { standardId, periodId },
        actor,
      )) as {
        rows: { codes: { code: string }[]; lines: number }[];
        debit: string;
        credit: string;
        unmappedLines: number;
      };
      expect(report.rows).toHaveLength(1);
      expect(report.rows[0]?.codes.every((row) => row.code === '00025')).toBe(
        true,
      );
      expect(report.rows[0]?.lines).toBe(2);
      expect(report.debit).toBe('999999999999999999.123456789123456789');
      expect(report.credit).toBe(report.debit);
      expect(report.unmappedLines).toBe(0);
      const config = await db.accountingConfiguration.findUniqueOrThrow({
        where: { id: standardId },
      });
      await expect(
        command(
          'save-configuration',
          {
            id: standardId,
            kind: 'coding-standards',
            title: config.title,
            attributes: {
              protocolVersion: '1.01',
              entities: '[]',
              extraFields: '[]',
            },
          },
          config.version,
        ),
      ).rejects.toThrow();
      expect(
        await db.accountingStandardEntity.count({ where: { standardId } }),
      ).toBe(3);
      await expect(
        service.analyticalReport(
          bookId,
          'standard-turnover',
          { standardId, periodId },
          { ...actor, branchIds: [] },
        ),
      ).rejects.toThrow();
      const mapping = (await service.analyticalReport(
        bookId,
        'standard-mapping',
        { standardId, entityId: (await entities())[0]!.id },
        actor,
      )) as { codes: { code: string }[] };
      expect(mapping.codes.some((row) => row.code === '00025')).toBe(true);
    });
    it('keeps legacy configuration JSON untouched when projecting local row identifiers', async () => {
      const config = await db.accountingConfiguration.findUniqueOrThrow({
        where: { id: standardId },
      });
      const before = JSON.stringify(config.attributes);
      await db.$transaction((tx) => syncStandardEntities(tx, config));
      expect(
        JSON.stringify(
          (
            await db.accountingConfiguration.findUniqueOrThrow({
              where: { id: standardId },
            })
          ).attributes,
        ),
      ).toBe(before);
    });
  },
);
