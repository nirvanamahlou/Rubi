import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { PartyReceiptForm } from './party-receipts';
import { FinanceInboxApiError } from '../api/finance-inbox-api';
vi.mock('@/modules/iam/access-context', () => ({
  useAccessPermissions: () => ['finance.read'],
  useRouteAccess: () => () => true,
  useScreenAccess: () => () => true,
  useTabAccess: () => () => true,
}));
function render(canWrite = false, denied = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const key = ['finance', 'party-balance', 'branch', 'payer'];
  client.setQueryData(key, {
    party: { branchId: 'branch', payerId: 'payer', name: 'agency-private' },
    revision: 'revision',
    totals: [
      {
        currencyCode: 'USD',
        total: '800',
        confirmedPaid: '150',
        outstanding: '650',
      },
    ],
    contracts: [
      {
        id: 'contract',
        number: '120001',
        createdAt: '2026-01-01T00:00:00Z',
        balances: [
          { currencyCode: 'USD', outstanding: '650', pendingFinance: '100' },
        ],
      },
    ],
  });
  client.setQueryData(['finance', 'settlement-accounts'], []);
  if (denied)
    client
      .getQueryCache()
      .find({ queryKey: key })!
      .setState({
        status: 'error',
        error: new FinanceInboxApiError('denied', 403),
      });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <PartyReceiptForm
        party={{ branchId: 'branch', payerId: 'payer', name: 'agency' }}
        canWrite={canWrite}
        onChanged={vi.fn()}
      />
    </QueryClientProvider>,
  );
}
describe('party debt and receipt panel', () => {
  it('shows all debt and pending receipts to read-only Finance users without exposing the write form', () => {
    const html = render();
    expect(html).toContain('agency-private');
    expect(html).toContain('650');
    expect(html).toContain('120001');
    expect(html).toContain('دریافت در انتظار تأیید');
    expect(html).not.toContain('ثبت واریزی و تخصیص');
  });
  it('offers a separate currency/account and one received amount with FIFO explanation', () => {
    const html = render(true);
    expect(html).toContain('ثبت واریزی و تخصیص به قراردادها');
    expect(html).toContain('قدیمی‌ترین');
    expect(html).toContain('حساب دریافت واریزی');
    expect(html).toContain('مبلغ واریزی');
  });
  it('hides cached party balances after access is revoked', () => {
    const html = render(true, true);
    expect(html).not.toContain('agency-private');
    expect(html).not.toContain('120001');
    expect(html).toContain('دسترسی');
  });
});
