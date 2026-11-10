import type { ComponentProps, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type * as Operations from './accounting-operations';
import { TooltipProvider } from '@/components/ui/overlays';
import { AccountingWorkspace } from './accounting-workspace';

vi.mock('@/modules/legal-entities/components/legal-entity-context', () => ({
  useLegalEntityContext: () => ({
    context: { selection: 'NIYAYESH_SEIR_SAHAR' },
  }),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
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
vi.mock('./accounting-operations', async (original) => ({
  ...(await original<typeof Operations>()),
  AccountingOperations: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));

function render({
  hasBook = false,
  failed = false,
  route = 'accounts/detail-types',
} = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(['accounting', 'books', 'NIYAYESH_SEIR_SAHAR'], {
    books: hasBook ? [{ id: 'book', active: true, isMain: true }] : [],
    branches: [],
  });
  if (hasBook)
    client.setQueryData(
      ['accounting', 'snapshot', 'book', 'NIYAYESH_SEIR_SAHAR'],
      {
        book: { id: 'book', branchId: 'branch' },
        periods: [],
        accounts: [],
        details: [],
        configurations: [],
        templates: [],
      },
    );
  if (failed)
    client
      .getQueryCache()
      .find({ queryKey: ['accounting', 'books', 'NIYAYESH_SEIR_SAHAR'] })!
      .setState({
        status: 'error',
        error: new Error('Denied'),
      });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <AccountingWorkspace
          pathname={'/finance/accounting/general-ledger/' + route}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  client.clear();
  return html;
}

describe('detail type route with no accounting books', () => {
  it('shows the requested type fields instead of the ledger creation form', () => {
    const html = render();
    for (const field of [
      'title',
      'titleEn',
      'defaultFirstCode',
      'parentTypeId',
      'classificationNumberLength',
      'description',
    ])
      expect(html).toContain(`id="detail-${field}"`);
    expect(html).toContain('کنترل رابطه پدر فرزندی');
    expect(html).not.toContain('accounting-ledger-form');
    expect(html).not.toContain('تخصیص سال مالی');
    expect(html).not.toContain('id="detail-code"');
    expect(html).toMatch(/id="detail-title"[^>]*required=""/);
    expect(html).toMatch(
      /id="detail-classificationNumberLength"[^>]*required=""/,
    );
    expect(html).toContain('pattern="([1-9]|1[0-9]|20)"');
    expect(html).not.toMatch(/id="detail-titleEn"[^>]*required=""/);
    expect(html).not.toMatch(/id="detail-defaultFirstCode"[^>]*required=""/);
  });

  it('explains the required ledger and disables every save action', () => {
    const html = render();
    expect(html).toContain('ابتدا دفتر حسابداری را تعریف کنید');
    expect(html).toContain(
      'href="/finance/accounting/general-ledger/base-information/ledgers"',
    );
    const saves = html.match(/<button[^>]*name="accountingAfterSave"[^>]*>/g);
    expect(saves).toHaveLength(3);
    for (const button of saves!) expect(button).toContain('disabled=""');
  });

  it('keeps normal book-scoped type persistence available', () => {
    const html = render({ hasBook: true });
    expect(html).toContain('id="detail-title"');
    expect(html).not.toContain('ابتدا دفتر حسابداری را تعریف کنید');
    const saves = html.match(/<button[^>]*name="accountingAfterSave"[^>]*>/g);
    expect(saves).toHaveLength(3);
    for (const button of saves!) expect(button).not.toContain('disabled=""');
  });

  it('keeps ledger creation reachable and preserves failed-read handling', () => {
    expect(render({ route: 'base-information/ledgers' })).toContain(
      'accounting-ledger-form',
    );
    const failed = render({ failed: true });
    expect(failed).toContain('دریافت اطلاعات حسابداری ناموفق بود');
    expect(failed).not.toContain('id="detail-title"');
  });
});
