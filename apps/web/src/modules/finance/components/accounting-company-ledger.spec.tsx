import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/overlays';
import { AccountingLedgerEditor } from './accounting-ledger-editor';
import { AccountingBaseList } from './accounting-base-list';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/i18n/link', () => ({
  default: ({ children, ...props }: ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock('@/modules/iam/access-context', () => ({
  useAccessPermissions: () => ['finance.read', 'finance.account.manage'],
  useRouteAccess: () => () => true,
  useTabAccess: () => () => true,
  useScreenAccess: () => () => true,
}));

describe('company ledger form and list', () => {
  const wrap = (node: React.ReactNode) =>
    renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>{node}</TooltipProvider>
      </QueryClientProvider>,
    );
  it('shows canonical immutable title and removes branch and currency selectors', () => {
    const html = wrap(
      <AccountingLedgerEditor
        snapshot={null}
        company={{
          id: 'company',
          code: 'JAHAN_BASTAN',
          title: 'جهان باستان پایتخت',
        }}
        branches={[{ id: 'branch', name: 'شعبه' }]}
        busy={false}
        run={vi.fn()}
        refresh={vi.fn()}
        onCreated={vi.fn()}
      />,
    );
    const title = html.match(/<input[^>]*id="ledger-title"[^>]*>/)?.[0];
    expect(title).toContain('readonly');
    expect(title).toContain('value="جهان باستان پایتخت"');
    expect(title).toContain('text-muted-foreground');
    expect(html).not.toContain('ledger-branch');
    expect(html).not.toContain('ledger-currency');
    expect(html).toContain('افزودن تخصیص سال مالی');
  });
  it('keeps the ledger list usable before the first ledger exists', () => {
    const html = wrap(
      <AccountingBaseList
        kind="ledgers"
        snapshot={null}
        books={[]}
        busy={false}
        refresh={vi.fn()}
        run={vi.fn()}
      />,
    );
    expect(html).toContain('دفتر کل');
    expect(html).toContain('<table');
    expect(html).not.toContain('ledger-code');
  });
  it('requires selecting one company in the header for creation', () => {
    const html = wrap(
      <AccountingLedgerEditor
        snapshot={null}
        company={null}
        branches={[]}
        busy={false}
        run={vi.fn()}
        refresh={vi.fn()}
        onCreated={vi.fn()}
      />,
    );
    expect(html).toContain('یک شرکت را از نوار بالای صفحه انتخاب کنید');
    expect(html.match(/<input[^>]*id="ledger-code"[^>]*>/)?.[0]).toContain(
      'disabled',
    );
  });
});
