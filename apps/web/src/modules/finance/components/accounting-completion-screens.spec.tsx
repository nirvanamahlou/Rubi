import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import { AccountingCompletionWorkspace } from './accounting-completion-workspace';
import { accountingCompletionRoute } from '../accounting-completion-routes';
import { accountingParityDefinitions } from './accounting-parity-definitions';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/i18n/link', () => ({
  default: ({ children, ...props }: ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock('@/modules/iam/access-context', () => ({
  useRouteAccess: () => () => true,
  useTabAccess: () => () => true,
  useScreenAccess: () => () => true,
  useAccessPermissions: () => [
    'finance.read',
    'finance.journal.read',
    'finance.account.manage',
    'finance.export',
  ],
}));
const book = {
  book: { id: 'synthetic-book', baseCurrency: 'IRR' },
  periods: [],
  accounts: [],
  details: [],
  configurations: [],
  fxRates: [],
  accountGroups: [],
  detailGroups: [],
  templates: [],
} as unknown as AccountingSnapshotV1;
describe('mounted completion screens', () => {
  it.each(
    accountingParityDefinitions
      .filter((d) => accountingCompletionRoute(d.route))
      .map((d) => d.route),
  )(
    'renders %s with scoped data and intact dependency gates',
    (route) => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
      });
      for (const kind of ['thresholds', 'aggregation', 'periods'])
        client.setQueryData(['accounting-tax', book.book.id, kind], {
          items: [],
          truncated: false,
        });
      client.setQueryData(['accounting-taxpayer-seller', book.book.id], null);
      const html = renderToStaticMarkup(
        <QueryClientProvider client={client}>
          <AccountingCompletionWorkspace book={book} route={route} />
        </QueryClientProvider>,
      );
      expect(html, route).toContain('<section');
      if (route.includes('/year-end/'))
        expect(html).toContain('صدور سند فعال نیست');
      if (route === 'taxpayer-system/cancellation-invoice')
        expect(html).toContain('ارسال و تولید شماره مالیاتی فعال نیست');
      client.clear();
    },
    15000,
  );
});
