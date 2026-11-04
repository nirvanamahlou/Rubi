import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { AccountingChartEditor } from './accounting-chart-editor';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/i18n/link', () => ({
  default: ({ children, ...props }: ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock('@/modules/iam/access-context', () => ({
  useAccessPermissions: () => ['finance.account.manage'],
  useRouteAccess: () => () => true,
  useTabAccess: () => () => true,
  useScreenAccess: () => () => true,
}));
describe('accounting chart without an accessible book', () => {
  it('renders the tree without a synthetic form selector or editable unbound account', () => {
    const run = vi.fn();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <AccountingChartEditor book={null} run={run} busy={false} />
      </QueryClientProvider>,
    );
    expect(html).not.toContain('coa-code');
    expect(html).not.toContain('coa-title');
    expect(html).not.toContain('ایجاد دفتر کل');
    expect(html).not.toContain('انتخاب دفتر کل');
    expect(html).toContain(
      'ساختار حساب برای شرکت جاری هنوز راه‌اندازی نشده است.',
    );
    expect(html).not.toContain('نمایش فرم');
    const saves = html.match(/<button[^>]*type="submit"[^>]*>/g) ?? [];
    expect(saves).toHaveLength(0);
    for (const button of saves) expect(button).toContain('disabled');
    expect(run).not.toHaveBeenCalled();
  });
});
