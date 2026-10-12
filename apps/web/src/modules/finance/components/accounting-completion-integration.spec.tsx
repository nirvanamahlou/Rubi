import type { ComponentProps, ReactNode } from 'react';
import type * as AccountingOperationsModule from './accounting-operations';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { accountingTaxForms, type AccountingSnapshotV1 } from '@nora/contracts';
import { taxpayerPages } from '../accounting-taxpayer-catalog';
import { accountingTaxRoute } from '../accounting-tax-model';
import { describe, expect, it, vi } from 'vitest';
import { AccountingWorkspace } from './accounting-workspace';
import { accountingCompletionRoute } from '../accounting-completion-routes';
import { accountingParityDefinitions } from './accounting-parity-definitions';
import { accountingNavigationGroups } from './accounting-navigation-workspace';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('bookId=book-b'),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/i18n/link', () => ({
  default: ({ children, ...props }: ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock('@/modules/iam/access-context', () => ({
  useAccessPermissions: () => [
    'finance.read',
    'finance.journal.read',
    'finance.account.manage',
  ],
  useRouteAccess: () => () => true,
  useTabAccess: () => () => true,
  useScreenAccess: () => () => true,
}));
vi.mock('./accounting-operations', async (original) => ({
  ...(await original<typeof AccountingOperationsModule>()),
  AccountingOperations: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock('./accounting-completion-workspace', () => ({
  AccountingCompletionWorkspace: ({
    book,
    route,
  }: {
    book: AccountingSnapshotV1;
    route: string;
  }) => <div data-completion={route} data-book={book.book.id} />,
}));
vi.mock('./accounting-year-end-workspace', () => ({
  AccountingYearEndWorkspace: ({ mode }: { mode: string }) => (
    <div data-year-end={mode} />
  ),
}));
vi.mock('./accounting-advanced-workspace', () => ({
  AccountingAdvancedWorkspace: () => <div data-legacy-settings="true" />,
}));

function render(route: string, failed = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(['accounting', 'books'], {
    books: [{ id: 'book-a' }, { id: 'book-b' }],
    branches: [],
  });
  client.setQueryData(['accounting', 'snapshot', 'book-b'], {
    book: { id: 'book-b' },
    periods: [],
    accounts: [],
    details: [],
    configurations: [],
    templates: [],
  });
  if (failed)
    client
      .getQueryCache()
      .find({ queryKey: ['accounting', 'snapshot', 'book-b'] })!
      .setState({ status: 'error', error: new Error('Denied') });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AccountingWorkspace pathname={'/finance/accounting/' + route} />
    </QueryClientProvider>,
  );
  client.clear();
  return html;
}

describe('prepared accounting screen integration', () => {
  it('mounts every prepared route with the requested authorized book', () => {
    const routes = accountingParityDefinitions.filter((item) =>
      accountingCompletionRoute(item.route),
    );
    const expected = new Set([
      ...taxpayerPages
        .map((p) => p.route)
        .filter((r) => r !== 'taxpayer-system/settings'),
      ...accountingTaxForms.flatMap((f) =>
        [f.route, accountingTaxRoute(f.route)?.listRoute].filter(
          (r): r is string => !!r,
        ),
      ),
      'general-ledger/reports/chart-structure',
      'general-ledger/reports/journal-lines',
      'general-ledger/year-end/nature-adjustment',
      'general-ledger/year-end/final',
    ]);
    expect(routes.map((r) => r.route).sort()).toEqual([...expected].sort());
    for (const { route } of routes) {
      const html = render(route);
      expect(html).toContain(`data-completion="${route}"`);
      expect(html).toContain('data-book="book-b"');
    }
  });
  it('does not mount the prepared screen after a failed book snapshot', () => {
    expect(render('taxpayer-system/seller-information', true)).not.toContain(
      'data-completion',
    );
  });
  it('preserves existing closing/opening and connection settings handlers', () => {
    for (const mode of ['closing', 'opening'])
      expect(render('general-ledger/year-end/' + mode)).toContain(
        `data-year-end="${mode}"`,
      );
    expect(render('taxpayer-system/settings')).toContain(
      'data-legacy-settings',
    );
    expect(render('taxpayer-system/execute')).not.toContain('data-completion');
  });
  it('makes both inherited tax lists reachable without claiming operational support', () => {
    const items = accountingNavigationGroups.flatMap((g) =>
      g.sections.flatMap((s) => s.items),
    );
    for (const key of ['tax-parties', 'aggregate-history']) {
      const route = 'tax-accounting/vat/lists/' + key;
      expect(
        items.filter((i) => i.href === '/finance/accounting/' + route),
      ).toHaveLength(1);
      expect(
        accountingParityDefinitions.find((i) => i.route === route)?.support,
      ).toBe('dependency');
    }
    for (const route of [
      'general-ledger/year-end/final',
      'general-ledger/year-end/nature-adjustment',
      'taxpayer-system/cancellation-invoice',
    ])
      expect(
        accountingParityDefinitions.find((i) => i.route === route)?.support,
      ).toBe('dependency');
  });
});
