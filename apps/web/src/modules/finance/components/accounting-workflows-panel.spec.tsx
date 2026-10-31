import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import type {
  AccountingSnapshotV1,
  AccountingWorkflowPageV1,
} from '@nora/contracts';
import { AccountingWorkflowsPanel } from './accounting-workflows-panel';
import { FinanceInboxApiError } from '../api/finance-inbox-api';
const access = vi.hoisted(() => ({
  permissions: [
    'finance.read',
    'finance.journal.read',
    'finance.journal.create',
  ],
}));
vi.mock('@/modules/iam/access-context', () => ({
  useAccessPermissions: () => access.permissions,
  useScreenAccess: () => () => true,
  useRouteAccess: () => () => true,
  useTabAccess: () => () => true,
}));
vi.mock('@/i18n/link', () => ({
  default: ({ children, ...props }: ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));
const book = {
  book: { id: 'book', branchId: 'branch', baseCurrency: 'IRR' },
  accounts: [],
  details: [],
  periods: [],
  configurations: [],
  fxRates: [],
} as unknown as AccountingSnapshotV1;
function render(denied = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const key = ['accounting', 'workflows', 'book'];
  const data: AccountingWorkflowPageV1 = {
    truncated: false,
    items: [
      {
        id: 'case',
        kind: 'SUPPLIER_REFUND',
        amount: '9007199254740992.0001',
        currency: 'USD',
        occurredAt: '2026-10-25T00:00:00Z',
        reference: 'manual-receipt-proof',
        cancelled: false,
        actorId: 'maker',
        facts: {},
        journal: { id: 'journal', status: 'POSTED', version: 1 },
      },
    ],
  };
  client.setQueryData(key, data);
  if (denied)
    client
      .getQueryCache()
      .find({ queryKey: key })!
      .setState({
        error: new FinanceInboxApiError('Denied', 403),
        status: 'error',
      });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AccountingWorkflowsPanel book={book} busy={false} run={vi.fn()} />
    </QueryClientProvider>,
  );
}
describe('inline accounting completion', () => {
  it('retains exact money and links the actual existing journal without a popup', () => {
    access.permissions = [
      'finance.read',
      'finance.journal.read',
      'finance.journal.create',
    ];
    const html = render();
    expect(html).toContain('9007199254740992.0001');
    expect(html).toContain('USD');
    expect(html).toContain('manual-receipt-proof');
    expect(html).toContain('journalId=journal');
    expect(html).not.toContain('role="dialog"');
    expect(html).toContain('ثبت مبنای عملیات');
  });
  it('hides capture controls from a read-only accountant', () => {
    access.permissions = ['finance.read', 'finance.journal.read'];
    expect(render()).not.toContain('ثبت مبنای عملیات');
  });
  it('hides cached evidence after scope is revoked', () => {
    const html = render(true);
    expect(html).not.toContain('manual-receipt-proof');
    expect(html).not.toContain('9007199254740992.0001');
    expect(html).toContain('role="alert"');
  });
});
