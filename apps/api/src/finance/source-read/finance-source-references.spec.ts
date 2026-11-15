import { describe, expect, it, vi } from 'vitest';
import type {
  AuthenticatedActor,
  FinanceHistoryItemV1,
  FinanceInboxItemV1,
} from '@nora/contracts';
import { FinanceSourceReferences } from './finance-source-references.service';
import type { DatabaseService } from '../../database/database.service';
import type { SalesFinanceContractRead } from '../../sales/finance-contract-read.public';
import type { ContractCompanyScope } from '../../sales/contract-company-scope.public';
import type { AccountingCompanyScope } from '../accounting/accounting-company-scope';
import { fiscalYearIndependentRequest } from '../fiscal-context/accounting-fiscal-actions';

const actor = {
  userId: 'user',
  branchIds: ['branch'],
  permissions: ['finance.read', 'finance.journal.read'],
} as AuthenticatedActor;
const history = (
  source: FinanceHistoryItemV1['source'],
  id: string,
  requestId: string,
): FinanceHistoryItemV1 => ({
  source,
  id,
  requestId,
  direction: 'PAYMENT',
  title: 'ثبت مالی',
  occurredAt: '2026-01-01T00:00:00Z',
  amount: '1.00000001',
  currencyCode: 'IRR',
  accountId: null,
  accountTitle: null,
  method: null,
  reference: '00099',
  installment: null,
  cumulativePaid: null,
  remainingAmount: null,
});
function fixture() {
  const event = {
    source: 'SALES',
    recordId: 'receipt',
    requestId: 'contract',
    journalId: 'journal',
    basisEvent: null,
  };
  const journal = {
    id: 'journal',
    bookId: 'book',
    periodId: 'old-year',
    number: 17,
    documentDate: '2025-09-01',
    status: 'POSTED',
    sourceKey: 'EVENT:actual',
  };
  const db = {
    client: {
      financeAccountingEvent: { findMany: vi.fn().mockResolvedValue([event]) },
      financeOperationalRequest: { findMany: vi.fn().mockResolvedValue([]) },
      reservationIntake: { findMany: vi.fn().mockResolvedValue([]) },
      accountingJournal: { findMany: vi.fn().mockResolvedValue([journal]) },
    },
  };
  const sales = {
    references: vi.fn(async (ids: string[]) =>
      [
        { id: 'contract', number: '00025' },
        { id: 'target', number: '00102' },
      ].filter((c) => ids.includes(c.id)),
    ),
    paymentReferences: vi
      .fn()
      .mockResolvedValue([
        { paymentId: 'receipt', id: 'contract', number: '00025' },
      ]),
  };
  const scope = {
    eventWhere: vi.fn().mockResolvedValue({ sourceKey: { not: 'hidden' } }),
    operationalWhere: vi
      .fn()
      .mockResolvedValue({ reference: { not: 'hidden' } }),
  };
  const companies = {
    current: vi
      .fn()
      .mockResolvedValue({ isAggregate: false, company: { id: 'company' } }),
  };
  const service = new FinanceSourceReferences(
    db as unknown as DatabaseService,
    sales as unknown as SalesFinanceContractRead,
    scope as unknown as ContractCompanyScope,
    companies as unknown as AccountingCompanyScope,
  );
  return { service, db, sales, event, journal };
}
describe('Exact Finance source references', () => {
  it('retains the originating contract commitment journal when a prior-year receipt is awaiting settlement', async () => {
    const { service, db, journal } = fixture();
    db.client.accountingJournal.findMany.mockResolvedValue([
      journal,
      { ...journal, id: 'legacy-receipt-journal', sourceKey: 'SALES:receipt' },
    ]);
    db.client.financeAccountingEvent.findMany.mockResolvedValue([
      {
        source: 'SALES',
        kind: 'SALES_CONTRACT_CONFIRMED',
        recordId: 'contract',
        requestId: 'contract',
        journalId: 'journal',
        basisEvent: null,
      },
    ]);
    const row = {
      source: 'SALES',
      sourceReference: 'receipt',
      sourceContextReference: 'contract',
    } as FinanceInboxItemV1;
    expect(
      (await service.inbox([row], actor))[0]?.references?.journals.map(
        (j) => j.id,
      ),
    ).toEqual(['journal', 'legacy-receipt-journal']);
  });
  it('prefers the actual event FK when a legacy source key points to a different journal', async () => {
    const { service, db, journal } = fixture();
    db.client.accountingJournal.findMany.mockResolvedValue([
      journal,
      {
        ...journal,
        id: 'legacy-other',
        sourceKey: 'SALES:receipt',
        number: 99,
      },
    ]);
    const [row] = await service.history(
      [history('SALES', 'receipt', 'contract')],
      actor,
    );
    expect(row?.references?.journals.map((j) => j.id)).toEqual(['journal']);
  });
  it('links a receipt to its real contract and event journal without losing leading zeroes or decimal strings', async () => {
    const { service, db } = fixture();
    const [row] = await service.history(
      [history('SALES', 'receipt', 'contract')],
      actor,
    );
    expect(row).toMatchObject({
      requestId: 'contract',
      amount: '1.00000001',
      reference: '00099',
      references: {
        contracts: [{ id: 'contract', number: '00025' }],
        journals: [{ id: 'journal', number: 17, periodId: 'old-year' }],
      },
    });
    expect(db.client.financeAccountingEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branchId: { in: ['branch'] },
          AND: [
            { sourceKey: { not: 'hidden' } },
            { OR: [{ source: 'SALES', recordId: 'receipt' }] },
          ],
        },
      }),
    );
    expect(
      db.client.accountingJournal.findMany.mock.calls[0]?.[0],
    ).toMatchObject({
      where: {
        book: { branchId: { in: ['branch'] }, legalEntityId: 'company' },
      },
    });
  });
  it('keeps source and destination contracts on a receipt allocation distinct', async () => {
    const { service, db } = fixture();
    db.client.financeAccountingEvent.findMany.mockResolvedValue([
      {
        source: 'SALES',
        recordId: 'allocation',
        requestId: 'target',
        journalId: 'journal',
        basisEvent: { source: 'SALES', requestId: 'contract' },
      },
    ]);
    expect(
      (
        await service.events(
          [{ source: 'SALES', recordId: 'allocation', requestId: 'target' }],
          actor,
        )
      )[0]?.contracts,
    ).toEqual([
      { id: 'contract', number: '00025' },
      { id: 'target', number: '00102' },
    ]);
  });
  it('resolves reservation intakes/purchases by FK and does not look up a typed contract number', async () => {
    const { service, db, sales } = fixture();
    db.client.financeAccountingEvent.findMany.mockResolvedValue([]);
    db.client.reservationIntake.findMany.mockResolvedValue([
      {
        id: 'intake',
        contractId: 'contract',
        servicePurchases: [{ id: 'purchase' }],
      },
    ]);
    const item = {
      source: 'RESERVATIONS',
      sourceReference: 'purchase',
      sourceContextReference: 'intake',
      contractReference: 'wrong old snapshot',
    } as FinanceInboxItemV1;
    expect(
      (await service.inbox([item], actor))[0]?.references?.contracts,
    ).toEqual([{ id: 'contract', number: '00025' }]);
    expect(sales.references).toHaveBeenCalledWith(['contract'], actor);
    expect(
      db.client.reservationIntake.findMany.mock.calls[0]?.[0],
    ).toMatchObject({
      where: {
        branchId: { in: ['branch'] },
        OR: [
          { id: { in: ['intake'] } },
          { servicePurchases: { some: { id: { in: ['purchase'] } } } },
        ],
      },
    });
  });
  it('does not invent contracts from free-text references and withholds journal numbers without journal.read', async () => {
    const { service, db } = fixture();
    db.client.financeAccountingEvent.findMany.mockResolvedValue([]);
    const [row] = await service.history(
      [history('INVOICE', 'invoice-payment', 'invoice')],
      { ...actor, permissions: ['finance.read'] },
    );
    expect(row?.references).toEqual({ contracts: [], journals: [] });
    expect(db.client.accountingJournal.findMany).not.toHaveBeenCalled();
  });
  it('uses a legacy exact source key only as a fallback and batches large result sets', async () => {
    const { service, db } = fixture();
    db.client.financeAccountingEvent.findMany.mockResolvedValue([]);
    db.client.accountingJournal.findMany.mockResolvedValue([
      {
        id: 'legacy',
        bookId: 'book',
        periodId: null,
        number: null,
        documentDate: null,
        status: 'DRAFT',
        sourceKey: 'INVOICE:payment',
      },
    ]);
    const rows = await service.history(
      Array.from({ length: 101 }, () =>
        history('INVOICE', 'payment', 'invoice'),
      ),
      actor,
    );
    expect(rows[0]?.references?.journals).toEqual([
      {
        id: 'legacy',
        bookId: 'book',
        periodId: null,
        number: null,
        auxiliaryNumber: null,
        documentDate: null,
        status: 'DRAFT',
      },
    ]);
    expect(db.client.financeAccountingEvent.findMany).toHaveBeenCalledTimes(2);
  });
  it('exempts only exact GET viewers from the active-year requirement, never lists or writes', () => {
    for (const path of [
      '/finance/source-contracts/contract/read',
      '/finance/accounting/books/book/journals/journal/read',
    ]) {
      expect(fiscalYearIndependentRequest(path, 'GET')).toBe(true);
      expect(fiscalYearIndependentRequest(path, 'POST')).toBe(false);
    }
    expect(
      fiscalYearIndependentRequest(
        '/finance/accounting/books/book/journals',
        'GET',
      ),
    ).toBe(false);
  });
});
