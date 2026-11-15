import { describe, expect, it, vi } from 'vitest';
import type {
  FinanceFiscalRequestV1,
  FinanceInboxItemV1,
  AuthenticatedActor,
} from '@nora/contracts';
import {
  FinanceFiscalStorage,
  financeFiscalDay,
  financeFiscalUtcRange,
  currentFinanceFiscalRequest,
} from './finance-fiscal-storage';
import { FinanceFiscalContextService } from './finance-fiscal-context.service';
import { fiscalInboxItems } from './finance-fiscal-inbox';
import { historyDateRange, readFinanceHistory } from '../finance-history';
import { selectFinanceInboxPage } from '../finance-inbox-query';
import { assertAccountingFiscalCommand } from './accounting-fiscal-command';

const year = {
  id: '00000000-0000-4000-8000-000000000001',
  bookId: 'book',
  fiscalYearId: 'year',
  title: '1405',
  code: '1405',
  startDate: '2026-03-21',
  endDate: '2027-03-20',
  status: 'OPEN' as const,
  yearActive: true,
  isDefault: true,
  version: 1,
};
const prior = {
  ...year,
  id: '00000000-0000-4000-8000-000000000002',
  title: '1404',
  startDate: '2025-03-21',
  endDate: '2026-03-20',
  isDefault: false,
};
const scope: FinanceFiscalRequestV1 = {
  actorId: 'actor',
  mode: 'default',
  companySelection: 'A',
  issuerCompanyId: 'issuer',
  company: { id: 'company', title: 'Company', code: 'A' },
  isAggregate: false,
  bookId: 'book',
  bookVersion: 1,
  defaultPeriodId: year.id,
  periods: [year, prior],
  period: year,
};
const storage = new FinanceFiscalStorage();
const item = (
  id: string,
  createdAt: string,
  remainingAmount = '7.00000001',
): FinanceInboxItemV1 => ({
  version: 1,
  id,
  source: 'FINANCE',
  kind: 'OPERATIONAL_REQUEST',
  sourceReference: id,
  sourceContextReference: id,
  contractReference: null,
  title: id,
  partyDisplaySnapshot: null,
  requesterDisplaySnapshot: null,
  description: '',
  status: 'PAYING',
  amount: { amount: '100.12345678', currencyCode: 'IRR' },
  settlement: { paidAmount: '93.12345677', remainingAmount },
  dueAt: null,
  createdAt,
  branchReference: 'branch',
  sourceVersion: 1,
  origin: 'PERSISTED_SOURCE',
});

describe('Finance fiscal isolation', () => {
  it("excludes another company's captured payments before history pagination", async () => {
    const read = vi.fn().mockResolvedValue([]);
    const eventRead = vi
      .fn()
      .mockResolvedValue([
        { source: 'OPERATIONAL', recordId: 'foreign-payment' },
      ]);
    const database = {
      client: {
        financeAccountingEvent: { findMany: eventRead },
        financeOperationalRevision: { findMany: read },
      },
    };
    await storage.run(scope, () =>
      readFinanceHistory(
        database as never,
        {} as never,
        {} as never,
        { source: 'OPERATIONAL' },
        {
          userId: 'actor',
          branchIds: ['branch'],
          permissions: ['finance.read'],
        } as AuthenticatedActor,
      ),
    );
    expect(read).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [{ id: { notIn: ['foreign-payment'] } }],
          transferAt: financeFiscalUtcRange(year.startDate, year.endDate),
        }),
        take: 26,
      }),
    );
    expect(eventRead.mock.calls[0]?.[0].where.NOT).toEqual({
      fiscalPeriodId: year.id,
    });
  });
  it('uses Tehran business midnight, leap days and historical DST boundaries', () => {
    expect(financeFiscalDay('2026-03-20T20:30:00Z')).toBe('2026-03-21');
    expect(financeFiscalDay('2026-02-29')).toBeNull();
    expect(financeFiscalUtcRange('2026-03-21', '2026-03-21')).toEqual({
      gte: new Date('2026-03-20T20:30:00Z'),
      lt: new Date('2026-03-21T20:30:00Z'),
    });
    const dst = financeFiscalUtcRange('2021-03-22', '2021-03-22');
    expect(financeFiscalDay(dst.gte)).toBe('2021-03-22');
    expect(financeFiscalDay(new Date(dst.gte.getTime() - 1))).toBe(
      '2021-03-21',
    );
    expect(dst.lt.getTime() - dst.gte.getTime()).toBe(23 * 3600000);
  });
  it('isolates concurrent requests and leaves source-owner internal calls untouched', async () => {
    expect(storage.require()).toBeNull();
    await Promise.all(
      [scope, { ...scope, actorId: 'other', period: prior }].map((value) =>
        storage.run(value, async () => {
          await Promise.resolve();
          expect(currentFinanceFiscalRequest()?.actorId).toBe(value.actorId);
          expect(storage.require()?.id).toBe(value.period?.id);
        }),
      ),
    );
    expect(currentFinanceFiscalRequest()).toBeUndefined();
  });
  it('never invents a default and rejects another year, company or out-of-range write', () => {
    storage.run({ ...scope, period: null, defaultPeriodId: null }, () =>
      expect(() => storage.require()).toThrow('تعریف نشده'),
    );
    storage.run(scope, () => {
      expect(() => storage.require('other-book')).toThrow();
      expect(() => storage.assertPeriod('book', prior.id)).toThrow();
      expect(() => storage.assertDate('2026-03-20', true)).toThrow();
      expect(() => storage.assertDate('2027-03-20', true)).not.toThrow();
      expect(storage.query('book', {})).toMatchObject({
        periodId: year.id,
        from: year.startDate,
        to: year.endDate,
      });
    });
    storage.run({ ...scope, period: { ...year, status: 'CLOSED' } }, () =>
      expect(() => storage.assertDate(year.startDate, true)).toThrow(),
    );
  });
  it('clips history at the database predicate before union ordering, pagination and export', () =>
    storage.run(scope, () => {
      expect(historyDateRange({}, 'transferAt')).toEqual({
        transferAt: financeFiscalUtcRange(year.startDate, year.endDate),
      });
      expect(historyDateRange({ to: '2025-03-20' }, 'transferAt')).toEqual({
        transferAt: { gte: new Date(0), lt: new Date(0) },
      });
    }));
  it('separates exact old open balances, excludes old closed/future data and retains source identity', () =>
    storage.run(scope, () => {
      const old = item('old', '2026-01-01T00:00:00Z');
      const current = item('current', '2026-03-20T20:30:00Z');
      const rows = fiscalInboxItems([
        old,
        current,
        item('zero', '2026-01-01T00:00:00Z', '0'),
        { ...old, id: 'closed', status: 'PAID' },
        item('future', '2027-03-21T00:00:00Z'),
      ]);
      expect(rows.map((row) => row.id)).toEqual(['old', 'current']);
      expect(rows[0]?.carryForward).toMatchObject({
        originalPeriodId: prior.id,
        originalDate: old.createdAt,
        originalYearTitle: '1404',
        balances: [{ remainingAmount: '7.00000001' }],
      });
      expect(
        selectFinanceInboxPage(rows, {}, 1, 25, '2026-11-15').items.map(
          (row) => row.id,
        ),
      ).toEqual(['current']);
      expect(
        selectFinanceInboxPage(
          rows,
          { fiscalBucket: 'CARRY_FORWARD' },
          1,
          25,
          '2026-11-15',
        ).items.map((row) => row.id),
      ).toEqual(['old']);
      expect(old).not.toHaveProperty('carryForward');
    }));
  it('preserves each currency and reports an unallocated original year honestly', () =>
    storage.run(scope, () => {
      const old = {
        ...item('old', '2024-01-01T00:00:00Z'),
        amount: null,
        settlement: null,
        reservationPurchase: {
          totals: [],
          lines: [
            {
              purchaseId: 'a',
              serviceTitle: '',
              supplierName: '',
              amount: '10.12',
              currencyCode: 'USD',
              paidAmount: '0',
              remainingAmount: '10.12',
              financeVersion: 1,
              status: 'PENDING' as const,
            },
            {
              purchaseId: 'b',
              serviceTitle: '',
              supplierName: '',
              amount: '20',
              currencyCode: 'EUR',
              paidAmount: '5',
              remainingAmount: '15',
              financeVersion: 1,
              status: 'PARTIALLY_PAID' as const,
            },
          ],
        },
      };
      expect(fiscalInboxItems([old])[0]?.carryForward).toMatchObject({
        originalPeriodId: null,
        originalYearTitle: null,
        balances: [
          { currencyCode: 'USD', remainingAmount: '10.12' },
          { currencyCode: 'EUR', remainingAmount: '15' },
        ],
      });
    }));
  it('checks bulk source IDs while retaining an explicitly validated move destination', async () => {
    const tx = {
      accountingPeriod: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ ...year, fiscalYear: { active: true } }),
      },
      accountingJournal: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ periodId: prior.id, status: 'DRAFT' }]),
      },
    };
    await storage.run(scope, () =>
      expect(
        assertAccountingFiscalCommand(
          tx as never,
          'book',
          'move-drafts',
          { periodId: prior.id, items: [{ id: year.id }] },
          storage,
        ),
      ).rejects.toThrow('سال مالی فعال'),
    );
    tx.accountingJournal.findMany.mockResolvedValue([
      { periodId: year.id, status: 'DRAFT' },
    ]);
    await storage.run(scope, () =>
      expect(
        assertAccountingFiscalCommand(
          tx as never,
          'book',
          'move-drafts',
          { periodId: prior.id, items: [{ id: year.id }] },
          storage,
        ),
      ).resolves.toBeUndefined(),
    );
  });
});

describe('shared default resolution', () => {
  const actor = { userId: 'actor' } as AuthenticatedActor;
  const companies = {
    current: vi.fn().mockResolvedValue({
      company: scope.company,
      selection: 'A',
      issuerCompanyId: 'issuer',
      isAggregate: false,
    }),
  };
  const periods = [
    { ...year, fiscalYear: { title: '1405', code: '1405', active: true } },
    { ...prior, fiscalYear: { title: '1404', code: '1404', active: true } },
  ];
  const database = {
    client: {
      accountingBook: {
        findFirst: vi.fn().mockResolvedValue({ id: 'book', version: 1 }),
      },
      accountingPeriod: { findMany: vi.fn().mockResolvedValue(periods) },
    },
  };
  const service = new FinanceFiscalContextService(
    database as never,
    companies as never,
  );
  it('shares a default but keeps personal overrides request-local without saving preferences', async () => {
    expect((await service.resolve(actor, {})).period?.id).toBe(year.id);
    expect(
      (await service.resolve(actor, { mode: 'temporary', periodId: prior.id }))
        .period?.id,
    ).toBe(prior.id);
    expect(
      (await service.resolve({ ...actor, userId: 'other' }, {})).period?.id,
    ).toBe(year.id);
    expect((await service.resolve(actor, {})).period?.id).toBe(year.id);
  });
  it('rejects forged actors, stale company/year/version and nonallocated temporary years', async () => {
    for (const hints of [
      { actorId: 'other' },
      { company: 'B' },
      { periodId: prior.id },
      { version: '2' },
      { mode: 'temporary', periodId: '00000000-0000-4000-8000-000000000003' },
    ])
      await expect(service.resolve(actor, hints)).rejects.toThrow();
  });
});
