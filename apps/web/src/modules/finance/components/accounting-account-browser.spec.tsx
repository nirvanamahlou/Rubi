import { renderToStaticMarkup } from 'react-dom/server';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountingAccountBrowser } from './accounting-account-browser';
import {
  addReviewSelection,
  fiscalReviewMonths,
  readReviewScope,
  type ReviewScope,
} from '../accounting-review-navigation';

const mock = vi.hoisted(() => ({
  params: new URLSearchParams(),
  query: vi.fn(),
  canExport: true,
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => mock.params }));
vi.mock('@tanstack/react-query', () => ({ useQuery: mock.query }));
vi.mock('@/components/system-preferences-provider', () => ({
  useSystemPreferences: () => ({ calendar: 'persian', language: 'fa' }),
}));
vi.mock('@/modules/iam/access-context', () => ({
  useRouteAccess: () => () => true,
  useAccessPermissions: () => (mock.canExport ? ['finance.export'] : []),
}));
vi.mock('./accounting-account-review-filters', () => ({
  AccountingAccountReviewFilters: () => <div>Filters</div>,
}));
vi.mock('./finance-source-references', () => ({
  FinanceJournalReadView: ({
    id,
    focusPosition,
  }: {
    id: string;
    focusPosition: number;
  }) => (
    <div data-document={id} data-position={focusPosition}>
      Synthetic journal
    </div>
  ),
}));

const book = {
  book: { id: 'test-book', title: 'Test book', baseCurrency: 'IRR' },
  periods: [{ id: 'fallback' }, { id: 'active' }],
  configurations: [],
} as unknown as AccountingSnapshotV1;

const scope: ReviewScope[] = [
  { axis: 'GROUP', key: 'group-id', label: 'Synthetic group' },
  { axis: 'CURRENCY', key: 'EUR', label: 'EUR' },
];

beforeEach(() => {
  mock.params = new URLSearchParams();
  mock.query.mockReset();
  mock.canExport = true;
  mock.query.mockReturnValue({ data: null });
});

function render() {
  return renderToStaticMarkup(
    <AccountingAccountBrowser book={book} activePeriodId="active" />,
  );
}

describe('account review links and reports', () => {
  it('restores the report scope registered in the URL and retains the active fiscal period', () => {
    mock.params = new URLSearchParams({
      reviewScope: JSON.stringify(scope),
      reviewAxis: 'TRACKING',
      reviewPeriod: 'fallback',
    });
    const html = render();
    expect(html).toContain('Synthetic group');
    expect(html).toContain('EUR');
    expect(mock.query).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining([
          expect.objectContaining({
            axis: 'TRACKING',
            periodId: 'active',
            scope:
              '[{"axis":"GROUP","key":"group-id"},{"axis":"CURRENCY","key":"EUR"}]',
          }),
        ]),
      }),
    );
    expect(addReviewSelection(scope, scope[1]!)).toEqual(scope);
    expect(readReviewScope('{"invalid":1}')).toEqual([]);
  });

  it('drops a linked scope and label when changing companies', () => {
    mock.params = new URLSearchParams({
      reviewBook: 'other-book',
      reviewScope: JSON.stringify(scope),
      reviewAxis: 'CURRENCY',
    });
    const html = render();
    expect(html).not.toContain('Synthetic group');
    expect(mock.query).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining([
          expect.objectContaining({ axis: 'GROUP', scope: '[]' }),
        ]),
      }),
    );
  });

  it('renders currency totals without mixing them with base-currency columns', () => {
    mock.params.set('reviewAxis', 'CURRENCY');
    mock.query.mockReturnValue({
      data: {
        rows: [
          {
            key: 'EUR',
            code: 'EUR',
            title: 'EUR',
            debit: '5000',
            credit: '0',
            opening: '0',
            balanceDebit: '5000',
            balanceCredit: '0',
            foreignOpening: '0',
            foreignDebit: '2.5',
            foreignCredit: '0',
            foreignBalance: '2.5',
          },
        ],
        lines: [],
        hasNext: false,
      },
    });
    const html = render();
    for (const value of [
      'مانده بدهکار',
      'گردش ارزی بدهکار',
      '>5000<',
      '>2.5<',
      'مشاهده گردش',
    ])
      expect(html).toContain(value);
  });

  it('restores the exact read-only journal and row from a movement link', () => {
    mock.params = new URLSearchParams({
      reviewScope: JSON.stringify(scope),
      reviewView: 'lines',
      reviewJournal: 'journal-fixture',
      reviewPosition: '51',
    });
    const html = render();
    expect(html).toContain('data-document="journal-fixture"');
    expect(html).toContain('data-position="51"');
    expect(html).toContain('بازگشت به ریز گردش');
    expect(mock.query).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it('enumerates Persian months including partial first and last months', () => {
    const months = fiscalReviewMonths('2026-04-05', '2026-05-07');
    expect(months).toMatchObject([
      { from: '2026-04-05', to: '2026-04-20' },
      { from: '2026-04-21', to: '2026-05-07' },
    ]);
  });
});
