import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type {
  FinanceContractReadV1,
  FinanceJournalReadV1,
} from '@nora/contracts';
import {
  FinanceContractReadView,
  FinanceJournalReadView,
  FinanceSourceReferenceLinks,
} from './finance-source-references';

const result = vi.hoisted(() => ({
  data: null as unknown,
  error: null as Error | null,
  key: [] as unknown[],
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: unknown[] }) => {
    result.key = options.queryKey;
    return { data: result.data, error: result.error };
  },
}));
vi.mock('../finance-fiscal-context', () => ({
  useFinanceFiscalContext: () => ({
    key: 'company:current-year',
    loading: false,
  }),
}));
describe('Readable Finance references', () => {
  it('shows exact string contract numbers and does not turn an unnumbered draft into document zero', () => {
    const html = renderToStaticMarkup(
      <FinanceSourceReferenceLinks
        references={{
          contracts: [{ id: 'contract-id', number: '00025' }],
          journals: [
            {
              id: 'journal-id',
              bookId: 'book',
              periodId: 'old',
              number: null,
              documentDate: null,
              status: 'DRAFT',
            },
          ],
        }}
      />,
    );
    expect(html).toContain('00025');
    expect(html).toContain('بدون شماره قطعی');
    expect(html).not.toContain('contract-id');
    expect(html).not.toContain('journal-id');
  });
  it('reads a contract by exact ID and includes passengers/services/prices/payments', () => {
    result.error = null;
    result.data = {
      contract: {
        id: 'contract-id',
        contractNumber: '00025',
        version: 2,
        customerNameSnapshot: 'خریدار',
        status: 'CONFIRMED',
        originName: 'تهران',
        destinationName: 'شیراز',
        departureDate: '2026-01-01',
        returnNotBefore: null,
        passengersDetail: [
          {
            displayNameSnapshot: 'مسافر قرارداد',
            birthDate: '',
            ageCategory: 'ADT',
          },
        ],
        servicesDetail: [
          { titleSnapshot: 'خدمت ثبت‌شده', status: 'CONFIRMED' },
        ],
        ticketSelections: [],
        hotelSelection: null,
        priceComponents: [
          { title: 'قیمت پایه', amount: '101.50', currencyCode: 'IRR' },
        ],
        balances: [],
        payments: [
          {
            amount: '101.50',
            currencyCode: 'IRR',
            dueAt: '2026-01-01',
            method: 'CASH',
            paymentReference: '00088',
            status: 'CONFIRMED',
          },
        ],
        pricingNotes: 'توضیح قرارداد',
      },
    } as unknown as FinanceContractReadV1;
    const html = renderToStaticMarkup(
      <FinanceContractReadView id="contract-id" />,
    );
    expect(result.key).toEqual([
      'finance-source-read',
      'company:current-year',
      '/finance/source-contracts/contract-id/read',
    ]);
    for (const value of [
      '00025',
      'مسافر قرارداد',
      'خدمت ثبت‌شده',
      'قیمت پایه',
      '00088',
      'توضیح قرارداد',
    ])
      expect(html).toContain(value);
    expect(html).not.toContain('<input');
  });
  it('reads the exact historical journal, with account/detail codes and both sides, without an editor or year switch', () => {
    result.data = {
      id: 'j',
      bookId: 'b',
      bookTitle: 'دفتر اول',
      periodTitle: '۱۴۰۴',
      number: 17,
      auxiliaryNumber: '00017',
      baseCurrency: 'IRR',
      debit: '100.00000001',
      credit: '0',
      documentDate: '2025-10-01',
      description: 'شرح اصلی سند',
      reference: '00088',
      status: 'POSTED',
      lines: [
        {
          position: 1,
          account: { code: '001', title: 'حساب ثبت‌شده' },
          details: [{ level: 4, code: '00025', title: 'طرف حساب' }],
          description: 'شرح ردیف',
          debit: '100.00000001',
          credit: '0',
          currency: 'IRR',
          foreignAmount: null,
          rate: null,
        },
      ],
    } satisfies FinanceJournalReadV1;
    const html = renderToStaticMarkup(
      <FinanceJournalReadView bookId="b" id="j" />,
    );
    expect(result.key[2]).toBe('/finance/accounting/books/b/journals/j/read');
    for (const value of [
      '۱۴۰۴',
      '001',
      '00025',
      'حساب ثبت‌شده',
      'شرح ردیف',
      'بدهکار',
      'بستانکار',
    ])
      expect(html).toContain(value);
    expect(html).not.toContain('<input');
  });
  it('shows access/read errors instead of keeping another record visible', () => {
    result.error = new Error('دسترسی مجاز نیست');
    const html = renderToStaticMarkup(<FinanceContractReadView id="other" />);
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('00025');
  });
});
