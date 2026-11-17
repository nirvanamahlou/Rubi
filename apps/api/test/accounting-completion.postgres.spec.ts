import {
  accountingTestUrl,
  assertAccountingTestDatabase,
} from './accounting-test-database';
import { randomUUID } from 'node:crypto';
import {
  importTaxReference,
  saveTaxMapping,
  taxMappingView,
} from '../src/finance/accounting/tax-reference';
import {
  finalizeSeasonal,
  seasonalPreview,
  seasonalSnapshot,
  setSeasonalRegion,
} from '../src/finance/accounting/seasonal-report';
import {
  saveTreasuryInstrument,
  treasuryInstruments,
} from '../src/finance/accounting/treasury-instruments';
import { treasuryConfigAttributes } from '../src/finance/accounting/accounting-treasury';
import { readAccountBrowser } from '../src/finance/accounting/accounting-account-browser';
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

  it('gates only required row mappings, preserves text codes and freezes finalized report values', async () => {
    const window = {
      period: { id: periodId },
      from: '2026-01-01',
      to: '2026-03-31',
    };
    const journal = await db.accountingJournal.findFirstOrThrow({
      where: { bookId, status: 'POSTED' },
    });
    const stamp = { createdByUserId: userId, updatedByUserId: userId };
    const currency = await db.masterCurrency.upsert({
      where: { code: 'ZXQ' },
      update: {},
      create: { ...stamp, code: 'ZXQ', name: 'Synthetic currency' },
    });
    const country = await db.masterCountry.upsert({
      where: { code: 'XZ' },
      update: {},
      create: { ...stamp, code: 'XZ', name: 'Synthetic country' },
    });
    const region = await db.masterRegion.create({
      data: {
        ...stamp,
        countryId: country.id,
        code: randomUUID().slice(0, 12),
        name: 'Synthetic region',
      },
    });
    const eventId = randomUUID();
    await db.financeAccountingEvent.create({
      data: {
        sourceKey: eventId,
        fingerprint: 'a'.repeat(64),
        source: 'SALES',
        recordId: eventId,
        requestId: randomUUID(),
        kind: 'SALES_CONTRACT_CONFIRMED',
        occurredAt: new Date(),
        branchId,
        actorId: userId,
        currency: currency.code,
        amount: '42.1500',
        journalId: journal.id,
        trackingNumber: 'C-0004',
      },
    });
    const read = (layout: 'CURRENCY' | 'REGION' | 'CURRENCY_REGION') =>
      db.$transaction((tx) => seasonalPreview(tx, bookId, window, layout));
    const finalize = (layout: 'CURRENCY' | 'CURRENCY_REGION', digest: string) =>
      db.$transaction((tx) =>
        finalizeSeasonal(tx, bookId, window, layout, digest, userId),
      );
    expect((await read('CURRENCY_REGION')).rows[0]?.missing).toEqual([
      'CURRENCY',
      'REGION',
    ]);
    await expect(finalize('CURRENCY', 'wrong')).rejects.toThrow();
    const imp = (
      kind: string,
      label: string,
      csv: string,
      previousReleaseId: string | null,
    ) =>
      db.$transaction((tx) =>
        importTaxReference(
          tx,
          bookId,
          { kind, label, csv, previousReleaseId },
          userId,
        ),
      );
    const map = (
      kind: string,
      sourceId: string,
      entryId: string,
      releaseId: string,
    ) =>
      db.$transaction((tx) =>
        saveTaxMapping(tx, bookId, {
          kind,
          sourceId,
          entryId,
          releaseId,
          previousEntryId: null,
        }),
      );
    const release = await imp(
      'CURRENCY',
      'test 1',
      'code,title\n0007,"Currency, test"',
      null,
    );
    const entry = await db.taxReferenceEntry.findFirstOrThrow({
      where: { releaseId: release.id },
    });
    await expect(
      imp('CURRENCY', 'bad', 'code,title\n001,A\n001,B', release.id),
    ).rejects.toThrow();
    await map('CURRENCY', currency.id, entry.id, release.id);
    const ready = await read('CURRENCY');
    expect(ready.rows[0]).toMatchObject({
      reference: 'C-0004',
      amount: '42.15',
      missing: [],
      currencyTarget: { code: '0007' },
    });
    await expect(finalize('CURRENCY', 'stale')).rejects.toThrow();
    const snapshot = await finalize('CURRENCY', ready.digest);
    await expect(finalize('CURRENCY', ready.digest)).resolves.toEqual(snapshot);
    const both = await read('CURRENCY_REGION');
    expect(both.rows[0]?.missing).toEqual(['REGION']);
    await expect(finalize('CURRENCY_REGION', both.digest)).rejects.toThrow();
    const geo = await imp('REGION', 'test 1', 'code,title\n009,Region', null);
    await expect(map('REGION', region.id, entry.id, geo.id)).rejects.toThrow();
    const geoEntry = await db.taxReferenceEntry.findFirstOrThrow({
      where: { releaseId: geo.id },
    });
    await map('REGION', region.id, geoEntry.id, geo.id);
    await db.$transaction((tx) =>
      setSeasonalRegion(tx, bookId, window, {
        journalId: journal.id,
        regionId: region.id,
        previousRegionId: null,
      }),
    );
    expect((await read('CURRENCY_REGION')).rows[0]?.missing).toEqual([]);
    const same = await imp(
      'CURRENCY',
      'test 2',
      'code,title\n0007,"Currency, test"',
      release.id,
    );
    expect((await read('CURRENCY')).rows[0]?.currencyTarget?.version).toBe(
      'test 2',
    );
    await imp('CURRENCY', 'test 3', 'code,title\n0007,New meaning', same.id);
    expect((await read('CURRENCY')).rows[0]?.missing).toEqual(['CURRENCY']);
    expect(
      (
        await db.$transaction((tx) => taxMappingView(tx, bookId, 'CURRENCY'))
      ).sources.find((s) => s.id === currency.id)?.entryId,
    ).toBeNull();
    const saved = await db.$transaction((tx) =>
      seasonalSnapshot(tx, bookId, periodId, snapshot.id),
    );
    expect(saved.rows).toMatchObject([
      {
        currencyTarget: {
          code: '0007',
          title: 'Currency, test',
          version: 'test 1',
        },
      },
    ]);
    await expect(
      db.$transaction((tx) =>
        seasonalSnapshot(tx, randomUUID(), periodId, snapshot.id),
      ),
    ).rejects.toThrow();
  });
  it('creates operational accounts and preserves cashier assignment intervals through changes', async () => {
    const book = { id: bookId, branchId, baseCurrency: 'IRR' };
    const person = await db.accountingConfiguration.create({
      data: {
        bookId,
        kind: 'detail-types',
        code: 'P',
        title: 'شخص',
        attributes: {},
      },
    });
    const people = await Promise.all(
      ['001', '002'].map((code) =>
        db.accountingDetail.create({
          data: {
            bookId,
            typeId: person.id,
            code,
            title: 'Synthetic ' + code,
            attributes: {},
          },
        }),
      ),
    );
    const save = (p: Record<string, unknown>, version?: number) =>
      db.$transaction((tx) =>
        saveTreasuryInstrument(tx, book, p, version, userId),
      );
    const p = {
      kind: 'cashboxes',
      title: 'Synthetic cash',
      operatorId: people[0]!.id,
    };
    const box = await save(p);
    await save({ ...p, id: box.id, title: 'New cash title' }, box.version);
    await expect(save({ ...p, id: box.id }, box.version)).rejects.toThrow();
    await save(
      { ...p, id: box.id, operatorId: people[1]!.id },
      box.version + 1,
    );
    const intervals = await db.treasuryCashierAssignment.findMany({
      where: { instrumentId: box.id },
      orderBy: { startsAt: 'asc' },
    });
    expect(intervals).toHaveLength(2);
    expect(intervals[0]!.endsAt).toEqual(intervals[1]!.startsAt);
    expect(intervals[1]!.endsAt).toBeNull();
    const history = await db.$transaction((tx) =>
      treasuryInstruments(tx, book, {
        view: 'cashiers',
        instrumentId: box.id,
        from: '2020-01-01',
        to: '2099-01-01',
      }),
    );
    expect(history.rows).toHaveLength(2);
    const bank = await db.financeSettlementAccount.create({
      data: {
        branchId,
        kind: 'BANK',
        title: 'Synthetic bank account',
        currencyCode: 'IRR',
        createdByUserId: userId,
      },
    });
    const provider = await db.accountingConfiguration.create({
      data: {
        bookId,
        kind: 'payment-providers',
        code: '001',
        title: 'Synthetic PSP',
        attributes: {},
      },
    });
    const terminal = {
      kind: 'terminals',
      providerId: provider.id,
      deviceType: 'کارت خوان',
      terminalNumber: '00015',
      merchantNumber: '00001',
      receivingBankId: bank.id,
    };
    const pos = await save(terminal);
    expect(
      await db.financeSettlementAccount.findUniqueOrThrow({
        where: { id: pos.id },
      }),
    ).toMatchObject({
      kind: 'POS',
      currencyCode: 'IRR',
      branchId,
      title: '00015',
    });
    await expect(
      save({ ...terminal, deviceType: 'unknown' }),
    ).rejects.toThrow();
    await expect(
      save({ ...terminal, receivingBankId: box.id }),
    ).rejects.toThrow();
    await expect(save(terminal)).rejects.toThrow();
    expect(
      await db.financeSettlementAccount.count({
        where: { branchId, kind: 'POS' },
      }),
    ).toBe(1);
    expect(() =>
      treasuryConfigAttributes('treasury-causes', '01', {
        documentType: 'unknown',
      }),
    ).toThrow();
  });
  it('filters by whole-document debit before account selection and uses the same scope for drilldown', async () => {
    const browse = (
      filters: Record<string, string>,
      from = '2026-01-01',
      scope = periodId,
    ) =>
      db.$transaction((tx) =>
        readAccountBrowser(tx, bookId, scope, from, '2026-12-31', {
          axis: 'SUBSIDIARY',
          accountIds: debitId,
          ...filters,
        }),
      );
    const filters = {
      minAmount: '26000000000000000000.26',
      maxAmount: '26000000000000000000.26',
    };
    const report = await browse(filters);
    expect(report.rows).toMatchObject([
      {
        key: debitId,
        opening: '0',
        debit: filters.minAmount,
        balance: filters.minAmount,
      },
    ]);
    const turnover = await browse({ ...filters, selectedKey: debitId });
    expect(turnover.lines).toHaveLength(26);
    expect(
      turnover.lines.every(
        (l) => l.number === 1 && l.debit === '1000000000000000000.01',
      ),
    ).toBe(true);
    expect((await browse(filters, '2026-04-01')).rows[0]).toMatchObject({
      opening: filters.minAmount,
      debit: '0',
    });
    expect((await browse({ ...filters, currencyOnly: 'true' })).rows).toEqual(
      [],
    );
    expect((await browse({ ...filters, traceableOnly: 'true' })).rows).toEqual(
      [],
    );
    expect((await browse(filters, undefined, randomUUID())).rows).toEqual([]);
    expect(
      (
        await browse({
          ...filters,
          minAmount: '26000000000000000000.27',
          maxAmount: '',
        })
      ).rows,
    ).toEqual([]);
    await expect(
      browse({ minAmount: '100', maxAmount: '99' }),
    ).rejects.toThrow();
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
