import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { FinanceFiscalSelector } from './finance-fiscal-selector';
import {
  FinanceFiscalBoundary,
  financeRouteNeedsYear,
} from './finance-fiscal-boundary';
import { AccountingFiscalDefault } from './accounting-fiscal-default';
import { AccountingWorkspace } from './accounting-workspace';
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
vi.mock('next/navigation', () => ({
  usePathname: () => '/finance/inbox',
  useSearchParams: () =>
    new URLSearchParams({ bookId: 'foreign-book', recordId: 'unallocated' }),
}));
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
  it('directs users without a fiscal year to ledger setup', () => {
    state.value = { active: true, loading: false, period: null };
    const html = renderToStaticMarkup(
      <FinanceFiscalBoundary>
        <div>Operational view</div>
      </FinanceFiscalBoundary>,
    );
    expect(html).toContain(
      'href="/finance/accounting/general-ledger/base-information/ledgers"',
    );
    expect(html).toContain('معرفی دفتر کل');
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

const companies = [
  {
    id: 'niyayesh',
    code: 'NIYAYESH_SEIR_SAHAR',
    title: 'نیایش سیر سحر',
    year: '1406',
  },
  { id: 'jahan', code: 'JAHAN_BASTAN', title: 'جهان باستان', year: '1405' },
  { id: 'ghesati', code: 'GHESATI_RO', title: 'قسطی رو', year: '1407' },
];
function renderFiscalList(
  company: (typeof companies)[number] | null,
  { allocated = true, loading = false, error = null as string | null } = {},
) {
  const client = new QueryClient();
  const companyKey = company?.code ?? 'ALL';
  const book = { id: 'ledger', legalEntityId: company?.id, active: false };
  client.setQueryData(['accounting', 'books', companyKey], {
    books: [
      { id: 'foreign-book', legalEntityId: 'other-company' },
      ...(company ? [book] : []),
    ],
  });
  client.setQueryData(['accounting', 'snapshot', book.id, companyKey], {
    book,
    configurations: [
      {
        id: 'assigned',
        kind: 'fiscal-years',
        title: company?.year,
        active: true,
      },
      { id: 'historical', kind: 'fiscal-years', title: '1404', active: false },
      { id: 'unallocated', kind: 'fiscal-years', title: '1410', active: true },
    ],
    periods: allocated
      ? [
          {
            id: 'default-period',
            fiscalYearId: 'assigned',
            startDate: '2026-03-21',
            endDate: '2027-03-20',
            isDefault: true,
          },
          {
            id: 'closed-period',
            fiscalYearId: 'historical',
            startDate: '2025-03-21',
            endDate: '2026-03-20',
            status: 'CLOSED',
          },
        ]
      : [],
  });
  state.value = {
    active: true,
    data: { company, companySelection: companyKey, isAggregate: !company },
    period: { id: 'closed-period' },
    loading,
    error,
  };
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AccountingWorkspace pathname="/finance/accounting/general-ledger/base-information/lists/fiscal-years" />
    </QueryClientProvider>,
  );
  client.clear();
  return html;
}

describe('read-only company fiscal year list', () => {
  it.each(companies)(
    'shows $title ledger allocations alongside their dates',
    (company) => {
      const html = renderFiscalList(company);
      expect(html).toContain(company.title);
      expect(html).toContain(company.year);
      expect(html).toContain('1404');
      expect(html).toContain('پیش‌فرض شرکت');
      expect(html).toContain('dateTime="2026-03-21"');
      expect(html).toContain('فروردین');
      expect(html).not.toContain('1410');
      expect(html).not.toMatch(/<(button|input|select|form|a)\b/);
    },
  );

  it('leaves an unallocated ledger empty and does not combine companies', () => {
    const empty = renderFiscalList(companies[1]!, { allocated: false });
    expect(empty).toContain(
      'برای این شرکت سال مالی به دفتر کل تخصیص داده نشده است.',
    );
    expect(empty).not.toContain('1410');
    expect(empty).not.toContain('<table');
    const aggregate = renderFiscalList(null);
    expect(aggregate).toContain('یک شرکت را از نوار بالا انتخاب کنید.');
    expect(aggregate).not.toContain('<table');
  });

  it('withholds old rows during a company switch or load failure', () => {
    const loading = renderFiscalList(companies[1]!, { loading: true });
    expect(loading).toContain('در حال بارگذاری…');
    expect(loading).not.toContain('1405');
    const failed = renderFiscalList(companies[1]!, { error: 'network error' });
    expect(failed).toContain('دریافت فهرست دوره‌های مالی ناموفق بود.');
    expect(failed).not.toContain('1405');
  });
});
