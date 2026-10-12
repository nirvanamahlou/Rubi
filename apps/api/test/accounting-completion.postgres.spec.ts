import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { AccountingCompletionService } from '../src/finance/accounting/accounting-completion.service';
import { AccountingTaxpayerService } from '../src/finance/accounting/accounting-taxpayer.service';
import { AccountingTaxService } from '../src/finance/accounting/accounting-tax.service';
const url = process.env.ACCOUNTING_COMPLETION_TEST_DATABASE_URL;
describe.skipIf(!url)('independent completion on isolated PostgreSQL', () => {
  let db: DatabaseClient,
    service: AccountingCompletionService,
    bookId: string,
    periodId: string,
    debitId: string,
    creditId: string;
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
  beforeAll(async () => {
    const target = new URL(url!);
    if (
      target.hostname !== '127.0.0.1' ||
      target.port !== '55442' ||
      target.pathname !== '/rubi_completion_test'
    )
      throw new Error('Dedicated completion test database required');
    db = createDatabaseClient(url);
    await db.branch.create({
      data: {
        id: branchId,
        code: branchId,
        name: 'Synthetic completion branch',
      },
    });
    for (const id of [userId, checkerId])
      await db.user.create({
        data: {
          id,
          username: id,
          displayName: 'Synthetic completion actor',
          passwordHash: 'not-a-login-credential',
        },
      });
    const book = await db.accountingBook.create({
      data: {
        branchId,
        code: randomUUID().slice(0, 16),
        title: 'Synthetic completion book',
        baseCurrency: 'IRR',
      },
    });
    bookId = book.id;
    const year = await db.accountingConfiguration.create({
      data: {
        bookId,
        code: '2026',
        kind: 'fiscal-years',
        title: '2026',
        attributes: {},
      },
    });
    const type = await db.accountingConfiguration.create({
      data: {
        bookId,
        code: '01',
        kind: 'voucher-types',
        title: 'Synthetic voucher',
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
    debitId = (
      await db.accountingAccount.create({
        data: {
          bookId,
          code: '101',
          title: 'Synthetic debit',
          level: 'SUBSIDIARY',
          nature: 'DEBIT',
          permanent: true,
          attributes: {},
        },
      })
    ).id;
    creditId = (
      await db.accountingAccount.create({
        data: {
          bookId,
          code: '201',
          title: 'Synthetic income',
          level: 'SUBSIDIARY',
          nature: 'CREDIT',
          permanent: false,
          attributes: {},
        },
      })
    ).id;
    const makeJournal = async (posted: boolean) => {
      const row = await db.accountingJournal.create({
        data: {
          bookId,
          periodId,
          typeId: type.id,
          makerId: userId,
          documentDate: '2026-03-01',
          description: 'Synthetic only',
          attributes: {},
          lines: {
            create: Array.from({ length: posted ? 52 : 2 }, (_, position) => ({
              position,
              accountId: position % 2 ? creditId : debitId,
              debit: position % 2 ? '0' : '1000000000000000000.01',
              credit: position % 2 ? '1000000000000000000.01' : '0',
              attributes: {},
            })),
          },
        },
      });
      if (posted)
        await db.accountingJournal.update({
          where: { id: row.id },
          data: {
            status: 'POSTED',
            approverId: checkerId,
            postedAt: new Date(),
            number: 1,
          },
        });
    };
    await makeJournal(true);
    await makeJournal(false);
    service = new AccountingCompletionService({ client: db } as never);
  }, 30000);
  afterAll(async () => {
    await db?.$disconnect();
  });

  it('paginates 52 posted lines with exact whole-filter totals and excludes the draft', async () => {
    const first = await service.journalLines(bookId, { periodId }, actor);
    const second = await service.journalLines(
      bookId,
      { periodId, page: '2' },
      actor,
    );
    expect(first.total).toBe(52);
    expect(first.rows).toHaveLength(50);
    expect(second.rows).toHaveLength(2);
    expect(
      new Set([...first.rows, ...second.rows].map((row) => row.id)).size,
    ).toBe(52);
    expect(first.debit).toBe('26000000000000000000.26');
    expect(first.credit).toBe(first.debit);
    expect(second.debit).toBe(first.debit);
    const filtered = await service.journalLines(
      bookId,
      { periodId, accountId: debitId },
      actor,
    );
    expect(filtered.total).toBe(26);
    expect(filtered.credit).toBe('0');
    const absent = await service.journalLines(
      bookId,
      { periodId, from: '2026-04-01' },
      actor,
    );
    expect(absent.total).toBe(0);
    expect(absent.debit).toBe('0');
  });
  it('isolates branches and reports unfinished and temporary balances without writes', async () => {
    await expect(
      service.journalLines(bookId, { periodId }, { ...actor, branchIds: [] }),
    ).rejects.toThrow();
    const count = await db.accountingJournal.count({ where: { bookId } });
    const readiness = await service.yearEndReadiness(bookId, periodId, actor);
    expect(readiness.unfinished).toBe(1);
    expect(readiness.posted).toBe(1);
    expect(readiness.exceptions).toEqual([
      expect.objectContaining({
        accountId: creditId,
        temporary: true,
        contrary: false,
        balance: '-26000000000000000000.26',
      }),
    ]);
    expect(readiness.executionAvailable).toBe(false);
    expect(await db.accountingJournal.count({ where: { bookId } })).toBe(count);
  });
  it('persists seller data, keeps the connector inactive and preserves replay/version guards', async () => {
    const seller = new AccountingTaxpayerService({ client: db } as never);
    const input = {
      key: randomUUID(),
      version: 0,
      values: {
        fvwMain_lkpPartyType_ComboBox_Input: 'شرکت',
        fvwMain_txtNationalID: '00000000001',
        fvwMain_txtEconomicID: '000000000002',
        fvwMain_txtCivilParticipationID: '',
      },
    };
    const saved = await seller.saveSeller(bookId, input, actor);
    expect(await seller.seller(bookId, actor)).toEqual(saved);
    expect(await seller.saveSeller(bookId, input, actor)).toEqual(saved);
    expect(
      await db.accountingConfiguration.count({
        where: { bookId, kind: 'taxpayer-seller' },
      }),
    ).toBe(1);
    expect(
      (
        await db.accountingConfiguration.findFirstOrThrow({
          where: { bookId, kind: 'taxpayer-seller' },
        })
      ).active,
    ).toBe(false);
    await expect(
      seller.saveSeller(bookId, { ...input, key: randomUUID() }, actor),
    ).rejects.toThrow();
    await expect(
      seller.seller(bookId, { ...actor, branchIds: [] }),
    ).rejects.toThrow();
  });
  it('persists the existing tax threshold adapter with exact derived values', async () => {
    const tax = new AccountingTaxService(
      { client: db } as never,
      { displayNames: async () => [] } as never,
    );
    const input = {
      key: randomUUID(),
      version: 0,
      values: {
        txtTitle: 'Synthetic threshold',
        decSmallDealsQuorum_input: '1000000000000000.01',
        dpEffectiveDate_MaskedTextBox: '2026-01-01',
        decSmallDealsMergeRate_input: '5',
      },
    };
    const saved = await tax.save(bookId, 'thresholds', input, actor);
    const read = await tax.list(bookId, 'thresholds', actor);
    expect(
      read.items.find((row) => row.id === saved.id)?.values
        .decSmallDealsMergeAmount_input,
    ).toBe('50000000000000.0005');
    expect(await tax.save(bookId, 'thresholds', input, actor)).toEqual(saved);
  });
});
