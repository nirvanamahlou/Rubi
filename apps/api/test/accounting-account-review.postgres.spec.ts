import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  AccountReviewAxis,
  AccountReviewSelection,
  AuthenticatedActor,
} from '@nora/contracts';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import { readAccountBrowser } from '../src/finance/accounting/accounting-account-browser';
import { AccountingService } from '../src/finance/accounting/accounting.service';
import {
  accountingTestUrl,
  assertAccountingTestDatabase,
} from './accounting-test-database';

const url = accountingTestUrl('ACCOUNTING_REVIEW_TEST_DATABASE_URL');
describe.skipIf(!url)('account review on isolated PostgreSQL', () => {
  let db: DatabaseClient;
  let bookId: string,
    periodId: string,
    typeId: string,
    personType: string,
    branchType: string;
  let groupId: string, generalId: string, accountId: string, offsetId: string;
  let person: string, branchDetail: string, project: string, journalId: string;
  const makerId = randomUUID();
  const approverId = randomUUID();
  const branchId = randomUUID();
  const actor: AuthenticatedActor = {
    userId: makerId,
    sessionId: randomUUID(),
    branchIds: [branchId],
    permissions: ['finance.read', 'finance.journal.read'],
  };

  beforeAll(async () => {
    assertAccountingTestDatabase(url!, '55594', 'detail_owner_seven_1118');
    db = createDatabaseClient(url);
    await db.branch.create({
      data: { id: branchId, code: branchId, name: 'Synthetic review' },
    });
    await db.user.createMany({
      data: [makerId, approverId].map((id) => ({
        id,
        username: id,
        displayName: 'Synthetic reviewer',
        passwordHash: 'no-login',
      })),
    });
    bookId = (
      await db.accountingBook.create({
        data: {
          branchId,
          code: randomUUID().slice(0, 16),
          title: 'Synthetic review book',
          baseCurrency: 'IRR',
        },
      })
    ).id;
    const config = (kind: string, code: string) =>
      db.accountingConfiguration
        .create({ data: { bookId, kind, code, title: code, attributes: {} } })
        .then((row) => row.id);
    const yearId = await config('fiscal-years', '1405');
    typeId = await config('voucher-types', 'Voucher');
    personType = await config('detail-types', 'People');
    branchType = await config('detail-types', 'Branches');
    const projectType = await config('detail-types', 'Projects');
    periodId = (
      await db.accountingPeriod.create({
        data: {
          bookId,
          fiscalYearId: yearId,
          startDate: '2026-03-21',
          endDate: '2027-03-20',
        },
      })
    ).id;
    const account = (
      code: string,
      level: string,
      parentId: string | null = null,
      permanent = true,
    ) =>
      db.accountingAccount
        .create({
          data: {
            bookId,
            code,
            title: code,
            level,
            parentId,
            nature: 'DEBIT',
            permanent,
            attributes: { traceable: true },
          },
        })
        .then((row) => row.id);
    groupId = await account('11', 'GROUP');
    generalId = await account('1101', 'GENERAL', groupId);
    accountId = await account('110101', 'SUBSIDIARY', generalId);
    const offsetGroup = await account('51', 'GROUP');
    const offsetGeneral = await account('5101', 'GENERAL', offsetGroup);
    offsetId = await account('510101', 'SUBSIDIARY', offsetGeneral, false);
    const detail = (typeId: string, code: string, title: string) =>
      db.accountingDetail
        .create({
          data: {
            bookId,
            typeId,
            code,
            title,
            attributes: { classificationNumber: '010' },
          },
        })
        .then((row) => row.id);
    person = await detail(personType, '0000001', 'Synthetic person');
    branchDetail = await detail(branchType, '0000001', 'Synthetic branch');
    project = await detail(projectType, '0000001', 'Synthetic project');
    const makeJournal = async (
      date: string,
      number: number | null,
      count: number,
      credit = false,
    ) => {
      const journal = await db.accountingJournal.create({
        data: {
          bookId,
          periodId,
          typeId,
          makerId,
          documentDate: date,
          description: 'Synthetic header',
          reference: 'REF-7',
          attributes: { auxiliaryNumber: 'AUX-7' },
          lines: {
            create: [
              ...Array.from({ length: count }, (_, index) => ({
                position: index + 1,
                accountId,
                detail4Id: person,
                detail5Id: branchDetail,
                detail6Id: credit ? branchDetail : project,
                description:
                  index === count - 1 && count > 1
                    ? 'Last line'
                    : 'Synthetic line',
                debit: credit ? '0' : '10.25',
                credit: credit ? '10.25' : '0',
                currency: credit ? 'USD' : 'EUR',
                foreignAmount: credit ? '1.25' : '2.5',
                rate: '4.1',
                attributes: {
                  trackingNumber: credit ? '002' : '001',
                  trackingDate: date,
                },
              })),
              {
                position: count + 1,
                accountId: offsetId,
                debit: credit ? '10.25' : '0',
                credit: credit ? '0' : String(count * 10.25),
                attributes: {},
              },
            ],
          },
        },
      });
      if (number !== null)
        await db.accountingJournal.update({
          where: { id: journal.id },
          data: {
            status: 'POSTED',
            number,
            approverId,
            postedAt: new Date(),
          },
        });
      return journal.id;
    };
    await makeJournal('2026-03-21', 1, 1);
    journalId = await makeJournal('2026-04-01', 2, 51);
    await makeJournal('2026-04-02', 3, 1, true);
    await makeJournal('2026-04-03', null, 1);
  }, 30000);

  afterAll(async () => {
    await db?.$disconnect();
  });

  const read = (
    axis: AccountReviewAxis,
    scope: AccountReviewSelection[] = [],
    extra: Record<string, string> = {},
  ) =>
    db.$transaction((tx) =>
      readAccountBrowser(tx, bookId, periodId, '2026-04-01', '2026-04-30', {
        axis,
        scope: JSON.stringify(scope),
        ...extra,
      }),
    );

  it('follows the full group, general, subsidiary, details, currency and tracking intersection', async () => {
    const steps = [
      ['GROUP', groupId],
      ['GENERAL', generalId],
      ['SUBSIDIARY', accountId],
      ['DETAIL4', person],
      ['DETAIL5', branchDetail],
      ['DETAIL6', project],
      ['CURRENCY', 'EUR'],
      ['TRACKING', '001'],
    ] as const;
    const scope: AccountReviewSelection[] = [];
    for (const [axis, key] of steps) {
      const report = await read(axis, scope);
      expect(
        report.rows.some((item) =>
          axis === 'TRACKING' ? item.code === key : item.key === key,
        ),
      ).toBe(true);
      scope.push({ axis, key });
    }
    const detail = (await read('DETAIL', scope)).rows;
    expect(detail.map((item) => item.key).sort()).toEqual(
      [person, branchDetail, project].sort(),
    );
    expect(
      detail.every(
        (item) => item.balance === '533' && item.classificationNumber === '010',
      ),
    ).toBe(true);
    expect((await read('CURRENCY', scope)).rows[0]).toMatchObject({
      key: 'EUR',
      opening: '10.25',
      debit: '522.75',
      balance: '533',
      foreignOpening: '2.5',
      foreignDebit: '127.5',
      foreignCredit: '0',
      foreignBalance: '130',
    });
    expect(
      (await read('TRACKING', [...scope, { axis: 'CURRENCY', key: 'USD' }]))
        .rows,
    ).toEqual([]);
  });

  it('deduplicates a repeated detail in levels 5 and 6, and separates identical codes and types', async () => {
    const scope: AccountReviewSelection[] = [
      { axis: 'SUBSIDIARY', key: accountId },
    ];
    const byType = await read('DETAIL_TYPE', scope);
    expect(byType.rows.find((item) => item.key === branchType)).toMatchObject({
      debit: '522.75',
      credit: '10.25',
      balance: '522.75',
    });
    const report = await read('DETAIL', scope, {
      groupDetailTypeId: branchType,
    });
    expect(report.rows).toMatchObject([{ key: branchDetail, credit: '10.25' }]);
    const level = await read('DETAIL6', scope, { detailTypeId: branchType });
    expect(level.rows).toMatchObject([
      { key: branchDetail, debit: '0', credit: '10.25' },
    ]);
    const byPerson = await read('DETAIL', [{ axis: 'CURRENCY', key: 'USD' }], {
      groupDetailTypeId: personType,
    });
    expect(byPerson.rows).toMatchObject([
      { key: person, balanceCredit: '10.25' },
    ]);
  });

  it('separates repeated tracking numbers by date and drills to exactly that occurrence', async () => {
    const rows = (
      await read('TRACKING', [{ axis: 'SUBSIDIARY', key: accountId }])
    ).rows;
    expect(
      rows
        .filter((row) => row.code === '001')
        .map((row) => row.trackingDate)
        .sort(),
    ).toEqual(['2026-03-21', '2026-04-01']);
    const selected = await read(
      'TRACKING',
      [{ axis: 'TRACKING', key: '001', trackingDate: '2026-04-01' }],
      { view: 'lines', page: '2' },
    );
    expect(selected.opening).toBe('0');
    expect(selected.lines[0]).toMatchObject({
      journalId,
      runningBalance: '522.75',
    });
    const key = rows.find(
      (row) => row.code === '001' && row.trackingDate === '2026-04-01',
    )!.key;
    expect(
      (await read('TRACKING', [], { selectedKey: key, page: '2' })).lines,
    ).toEqual(selected.lines);
  });

  it('preserves opening and running balances across pages, line searches and export', async () => {
    const scope: AccountReviewSelection[] = [
      { axis: 'SUBSIDIARY', key: accountId },
      { axis: 'TRACKING', key: '001' },
    ];
    const first = await read('TRACKING', scope, { view: 'lines' });
    const next = await read('TRACKING', scope, { view: 'lines', page: '2' });
    const filtered = await read('TRACKING', scope, {
      view: 'lines',
      lineSearch: 'Last line',
    });
    const exported = await read('TRACKING', scope, {
      view: 'lines',
      export: 'true',
    });
    expect(first.opening).toBe('10.25');
    expect(first.lines).toHaveLength(50);
    expect(first.hasNext).toBe(true);
    expect(first.lines.at(-1)?.runningBalance).toBe('522.75');
    expect(next.lines).toHaveLength(1);
    expect(next.lines[0]).toMatchObject({
      journalId,
      number: 2,
      position: 51,
      runningBalance: '533',
      reference: 'REF-7',
      secondaryNumber: 'AUX-7',
      trackingNumber: '001',
      trackingDate: '2026-04-01',
      currency: 'EUR',
      foreignAmount: '2.5',
      rate: '4.1',
    });
    expect(filtered.lines).toEqual(next.lines);
    expect(exported.lines).toEqual([...first.lines, ...next.lines]);
    expect(new Set(exported.lines.map((item) => item.id)).size).toBe(51);
  });

  it('combines document and account filters without including drafts by default', async () => {
    const scope: AccountReviewSelection[] = [{ axis: 'GROUP', key: groupId }];
    const report = await read('SUBSIDIARY', scope, {
      numberFrom: '2',
      numberTo: '2',
      typeIds: typeId,
      accountType: 'PERMANENT',
      hasBalance: 'true',
    });
    expect(report.rows).toMatchObject([
      { key: accountId, opening: '0', debit: '522.75' },
    ]);
    const draft = await read('SUBSIDIARY', scope, {
      view: 'lines',
      statuses: 'DRAFT',
    });
    expect(draft.lines).toMatchObject([
      { number: null, status: 'DRAFT', runningBalance: '10.25' },
    ]);
    expect(
      (
        await read('SUBSIDIARY', [], {
          accountIds: offsetId,
          accountType: 'PERMANENT',
        })
      ).rows,
    ).toEqual([]);
    await expect(
      read('SUBSIDIARY', [], { statuses: 'CANCELLED' }),
    ).rejects.toThrow();
    await expect(
      read('SUBSIDIARY', [], { numberFrom: '4', numberTo: '2' }),
    ).rejects.toThrow();
  });

  it('requires report, export and book permissions and does not trust a foreign period', async () => {
    const service = new AccountingService({ client: db } as never, {} as never);
    const run = (query: Record<string, string>, who = actor) =>
      service.analyticalReport(
        bookId,
        'account-browser',
        { periodId, ...query },
        who,
      );
    await expect(run({ export: 'true' })).rejects.toThrow();
    await expect(
      run({}, { ...actor, branchIds: [randomUUID()] }),
    ).rejects.toThrow();
    await expect(run({ periodId: randomUUID() })).rejects.toThrow();
    await expect(
      service.readJournal(bookId, journalId, actor, periodId),
    ).resolves.toMatchObject({ id: journalId });
    await expect(
      service.readJournal(bookId, journalId, actor, randomUUID()),
    ).rejects.toThrow();
    await expect(
      run(
        { export: 'true' },
        { ...actor, permissions: [...actor.permissions, 'finance.export'] },
      ),
    ).resolves.toMatchObject({
      rows: expect.arrayContaining([expect.objectContaining({ key: groupId })]),
    });
  });
});
