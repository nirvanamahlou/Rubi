import { FinanceInboxApiError } from '../api/finance-inbox-api';
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  AccountingFinancialEventV1,
  AccountingSnapshotV1,
} from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import { AccountingFinancialEvents } from './accounting-financial-events';

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
    'finance.journal.create',
    'finance.account.manage',
  ],
}));
const book = {
  book: { id: 'book', baseCurrency: 'IRR' },
  periods: [],
  accounts: [],
  details: [],
  configurations: [],
} as unknown as AccountingSnapshotV1;
const event: AccountingFinancialEventV1 = {
  id: 'source-event',
  source: 'SALES',
  kind: 'CUSTOMER_RECEIPT',
  requestId: 'source-contract',
  reference: 'manual-receipt',
  amount: '1234567890123456.0001',
  currency: 'USD',
  occurredAt: '2026-10-18T08:00:00Z',
  createdAt: '2026-10-18T08:00:01Z',
  lastError: null,
  journal: null,
};
function render(items: AccountingFinancialEventV1[], denied = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(['accounting', 'financial-events', 'book', '', false], {
    version: 1,
    items,
    nextCursor: null,
  });
  client.setQueryData(
    ['accounting', 'financial-events-reconciliation', 'book'],
    { version: 1, rows: [] },
  );
  if (denied)
    client
      .getQueryCache()
      .find({
        queryKey: ['accounting', 'financial-events', 'book', '', false],
      })!
      .setState({
        error: new FinanceInboxApiError('دسترسی تغییر کرده است.', 403),
        status: 'error',
      });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AccountingFinancialEvents book={book} busy={false} run={vi.fn()} />
    </QueryClientProvider>,
  );
}
describe('financial source accounting screen', () => {
  it('shows the exact source decimal, currency, manual receipt and missing-rule reason', () => {
    const html = render([
      { ...event, lastError: 'قاعده مصوب تنظیم نشده است.' },
    ]);
    expect(html).toContain(event.amount);
    expect(html).toContain('USD');
    expect(html).toContain('manual-receipt');
    expect(html).toContain('قاعده مصوب تنظیم نشده است.');
    expect(html).toContain('تنظیم و ایجاد سند');
    expect(html).not.toContain('role="dialog"');
  });
  it('links the actual existing journal instead of offering a second creation', () => {
    const html = render([
      {
        ...event,
        journal: {
          id: 'actual-journal',
          bookId: 'actual-book',
          status: 'POSTED',
        },
      },
    ]);
    expect(html).toContain('journalId=actual-journal');
    expect(html).toContain('bookId=actual-book');
    expect(html).toContain('ثبت نهایی');
    expect(html).not.toContain('تنظیم و ایجاد سند');
  });
  it('hides cached amounts and receipts when current authorization is denied', () => {
    const html = render([event], true);
    expect(html).not.toContain(event.amount);
    expect(html).not.toContain('manual-receipt');
    expect(html).toContain('دسترسی به اطلاعات این دفتر');
  });
  it('does not fabricate financial rows for an empty book', () => {
    const html = render([]);
    expect(html).toContain('رویداد مالی جدیدی ثبت نشده است.');
    expect(html).not.toContain('manual-receipt');
  });
});
