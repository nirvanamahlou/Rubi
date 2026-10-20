import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ReceiptAllocationPanel } from './receipt-allocation-panel';
import { FinanceInboxApiError } from '../api/finance-inbox-api';

vi.mock('@/modules/iam/access-context', () => ({
  useRouteAccess: () => () => true,
  useTabAccess: () => () => true,
  useScreenAccess: () => () => true,
  useAccessPermissions: () => ['finance.read', 'finance.journal.read'],
}));
function render(denied = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const queryKey = ['finance', 'receipt-allocation', 'event', ''];
  client.setQueryData(queryKey, {
    version: 1,
    sourceContractNumber: 'private-contract-number',
    availableAmount: '1234567890123456.0001',
    reservedRefunds: '3',
    currency: 'USD',
    accountingReady: true,
    allocations: [],
    nextCursor: null,
  });
  if (denied)
    client
      .getQueryCache()
      .find({ queryKey })!
      .setState({
        status: 'error',
        error: new FinanceInboxApiError('Access denied', 403),
      });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ReceiptAllocationPanel
        eventId="event"
        onChanged={vi.fn()}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
}
describe('receipt allocation information access', () => {
  it('preserves exact amounts and presents the panel inline for read-only users', () => {
    const html = render();
    expect(html).toContain('1234567890123456.0001');
    expect(html).toContain('private-contract-number');
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('ثبت تخصیص دریافت');
  });
  it('hides cached contract and financial data after access is revoked', () => {
    const html = render(true);
    expect(html).not.toContain('1234567890123456.0001');
    expect(html).not.toContain('private-contract-number');
    expect(html).toContain('دسترسی به اطلاعات تخصیص وجود ندارد.');
  });
});
