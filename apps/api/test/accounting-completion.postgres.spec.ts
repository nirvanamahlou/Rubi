import {
  accountingTestUrl,
  assertAccountingTestDatabase,
} from './accounting-test-database';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { AccountingCompletionService } from '../src/finance/accounting/accounting-completion.service';
import { AccountingTaxpayerService } from '../src/finance/accounting/accounting-taxpayer.service';
import { AccountingTaxService } from '../src/finance/accounting/accounting-tax.service';
const url = accountingTestUrl('ACCOUNTING_COMPLETION_TEST_DATABASE_URL');
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
    assertAccountingTestDatabase(url!, '55442', 'rubi_completion_test');
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
    const exported = await service.journalLines(
      bookId,
      { periodId, export: 'true' },
      { ...actor, permissions: [...actor.permissions, 'finance.export'] },
    );
    expect(exported.rows).toHaveLength(52);
    expect(exported.total).toBe(52);
    expect(exported.debit).toBe(first.debit);
    await expect(
      service.journalLines(bookId, { periodId, export: 'true' }, actor),
    ).rejects.toThrow();
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
  it('counts the original issuer, later editors and reviewers distinctly and drills into the same scoped journals', async () => {
    const journal = await db.accountingJournal.create({
      data: {
        bookId,
        periodId,
        makerId: checkerId,
        documentDate: '2026-03-21',
        description: 'Synthetic history fixture',
        version: 3,
        status: 'APPROVED',
        approverId: userId,
        attributes: {},
        lines: {
          create: [
            {
              position: 0,
              accountId: debitId,
              debit: '101',
              credit: '0',
              currency: 'USD',
              foreignAmount: '1.01',
              rate: '100',
              attributes: {},
            },
            {
              position: 1,
              accountId: creditId,
              debit: '0',
              credit: '101',
              currency: 'USD',
              foreignAmount: '1.01',
              rate: '100',
              attributes: {},
            },
          ],
        },
      },
    });
    const creation = await db.accountingCommand.create({
      data: {
        bookId,
        actorId: userId,
        key: randomUUID(),
        hash: 'a'.repeat(64),
        action: 'journal-document-save',
        result: { id: journal.id, version: 1 },
      },
    });
    await db.accountingJournalStateEvent.create({
      data: {
        bookId,
        journalId: journal.id,
        commandId: creation.id,
        actorId: userId,
        sequence: 0,
        eventType: 'CREATE',
        toStatus: 'DRAFT',
        journalVersion: 1,
        newPeriodId: periodId,
        newDocumentDate: '2026-03-21',
      },
    });
    for (const version of [2, 3])
      await db.accountingCommand.create({
        data: {
          bookId,
          actorId: checkerId,
          key: randomUUID(),
          hash: 'b'.repeat(64),
          action: 'journal-document-save',
          result: { id: journal.id, version },
        },
      });
    const review = await db.accountingCommand.create({
      data: {
        bookId,
        actorId: userId,
        key: randomUUID(),
        hash: 'c'.repeat(64),
        action: 'journal-approve',
        result: { id: journal.id },
      },
    });
    await db.accountingJournalStateEvent.create({
      data: {
        bookId,
        journalId: journal.id,
        commandId: review.id,
        actorId: userId,
        sequence: 0,
        eventType: 'STATUS',
        fromStatus: 'DRAFT',
        toStatus: 'APPROVED',
        journalVersion: 3,
        oldPeriodId: periodId,
        newPeriodId: periodId,
        oldDocumentDate: '2026-03-21',
        newDocumentDate: '2026-03-21',
      },
    });
    const filter = { periodId, from: '2026-03-21', to: '2026-03-21' };
    const users = await service.journalBrowser(
      bookId,
      { ...filter, axis: 'user', selectedKey: userId },
      actor,
    );
    expect(users.historicalGap).toBe(false);
    expect(users.rows.find((row) => row.key === userId)).toMatchObject({
      issued: 1,
      issuedLines: 2,
      changed: 0,
      reviewed: 1,
    });
    expect(users.rows.find((row) => row.key === checkerId)).toMatchObject({
      issued: 0,
      changed: 1,
      changedLines: 2,
      reviewed: 0,
    });
    expect(users.documents.map((row) => row.id)).toEqual([journal.id]);
    expect(users.totalDocuments).toBe(1);
    const month = await service.journalBrowser(
      bookId,
      { ...filter, axis: 'monthly', calendar: 'PERSIAN' },
      actor,
    );
    expect(month.rows[0]).toMatchObject({
      key: '1405-01',
      issued: 1,
      changed: 1,
      reviewed: 1,
    });
    const amount = await service.journalLines(
      bookId,
      {
        ...filter,
        status: 'APPROVED',
        currency: 'USD',
        amountMode: 'FOREIGN',
        description: 'fixture',
        descriptionMode: 'endsWith',
      },
      actor,
    );
    expect(amount).toMatchObject({
      total: 2,
      currency: 'USD',
      debit: '1.01',
      credit: '1.01',
    });
    expect(amount.rows.map((row) => [row.debit, row.credit])).toEqual([
      ['1.01', '0'],
      ['0', '1.01'],
    ]);
    const legacy = await service.journalBrowser(
      bookId,
      { periodId, from: '2026-03-01', to: '2026-03-01' },
      actor,
    );
    expect(legacy.historicalGap).toBe(true);
    await expect(
      service.journalBrowser(
        bookId,
        { ...filter, axis: 'monthly', calendar: 'PERSIAN' },
        { ...actor, branchIds: [] },
      ),
    ).rejects.toThrow();
  });
});
