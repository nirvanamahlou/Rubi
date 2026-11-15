import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { FinanceFiscalSelector } from './finance-fiscal-selector';
import { financeRouteNeedsYear } from './finance-fiscal-boundary';
import { AccountingFiscalDefault } from './accounting-fiscal-default';
const state = vi.hoisted(() => ({
  value: null as Record<string, unknown> | null,
  permissions: ['finance.read', 'finance.account.manage'],
}));
vi.mock('../finance-fiscal-context', () => ({
  useFinanceFiscalContext: () => state.value,
}));
vi.mock('@/modules/iam/access-context', () => ({
  useAccessPermissions: () => state.permissions,
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/finance/inbox' }));
vi.mock('@/components/access-link', () => ({ default: 'a' }));
describe('Finance year controls', () => {
  it('renders the default period once, with its default marker on the actual selected option', () => {
    const period = {
      id: 'period-1405',
      title: '1405',
      isDefault: true,
      yearActive: true,
      status: 'OPEN',
    };
    state.value = {
      active: true,
      data: { periods: [period], defaultPeriodId: period.id },
      period,
      temporary: false,
      loading: false,
      writing: false,
    };
    const html = renderToStaticMarkup(<FinanceFiscalSelector />);
    expect(html.match(/<option /g)).toHaveLength(1);
    expect(html).toContain('value="period-1405" selected=""');
    expect(html).toContain('1405 (پیش‌فرض)');
    expect(html).not.toContain('value=""');
    expect(html).not.toContain('بازگشت به پیش‌فرض');
  });
  it('hides the header control outside permitted Finance routes and shows undefined explicitly', () => {
    state.value = { active: false };
    expect(renderToStaticMarkup(<FinanceFiscalSelector />)).toBe('');
    state.value = {
      active: true,
      data: { periods: [], defaultPeriodId: null },
      period: null,
      temporary: false,
      loading: false,
      writing: false,
    };
    const html = renderToStaticMarkup(<FinanceFiscalSelector />);
    expect(html).toContain('سال مالی:');
    expect(html).toContain('تعریف نشده');
    expect(html).not.toContain('localStorage');
  });
  it('displays the company default, read-only historical years and a personal reset action', () => {
    const period = {
      id: 'year',
      title: '1405',
      isDefault: true,
      yearActive: true,
      status: 'OPEN',
    };
    state.value = {
      active: true,
      data: {
        periods: [
          period,
          {
            ...period,
            id: 'old',
            title: '1404',
            status: 'CLOSED',
            isDefault: false,
          },
        ],
        defaultPeriodId: 'year',
      },
      period,
      temporary: true,
      loading: false,
      writing: true,
    };
    const html = renderToStaticMarkup(<FinanceFiscalSelector />);
    expect(html).toContain('1405');
    expect(html).toContain('1404 (بسته)');
    expect(html).toContain('بازگشت به پیش‌فرض');
    expect(html.match(/<select[^>]*>/)?.[0]).toContain('disabled');
  });
  it('keeps setup routes reachable without a year and guards operational views', () => {
    for (const path of [
      '/finance',
      '/finance/accounting/general-ledger/base-information/ledgers',
      '/finance/accounting/general-ledger/base-information/lists/fiscal-years',
      '/finance/accounting/general-ledger/accounts/details',
    ])
      expect(financeRouteNeedsYear(path)).toBe(false);
    for (const path of [
      '/finance/inbox',
      '/finance/accounting/general-ledger/documents',
      '/finance/accounting/general-ledger/reports/trial-balance',
    ])
      expect(financeRouteNeedsYear(path)).toBe(true);
  });
  it('requires an allocated active year and the existing manager permission for changing the shared default', () => {
    const book = {
      book: { version: 1 },
      periods: [{ id: 'period', fiscalYearId: 'year', isDefault: true }],
      configurations: [
        { id: 'year', kind: 'fiscal-years', title: '1405', active: true },
      ],
    } as AccountingSnapshotV1;
    const render = () =>
      renderToStaticMarkup(
        <QueryClientProvider client={new QueryClient()}>
          <AccountingFiscalDefault
            book={book}
            yearId="year"
            busy={false}
            run={vi.fn()}
          />
        </QueryClientProvider>,
      );
    expect(render()).toContain('checked');
    state.permissions = ['finance.read'];
    expect(render().match(/<input[^>]*>/)?.[0]).toContain('disabled');
    state.permissions = ['finance.read', 'finance.account.manage'];
    book.periods = [];
    expect(render()).toContain('ابتدا سال مالی را به دفتر تخصیص دهید');
    expect(render().match(/<input[^>]*>/)?.[0]).toContain('disabled');
  });
});
