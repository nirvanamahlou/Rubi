import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Bootstrap } from './api';
import { PettyRegistrations } from './petty-registrations';
const bootstrap: Bootstrap = {
  permissions: ['procurement.request.create'],
  branches: [{ id: 'branch-a', label: 'Branch' }],
  defaultBranchId: 'branch-a',
  requester: null,
  currencies: [],
  policy: 'POLICY_NOT_CONFIGURED',
  finance: 'NOT_CONNECTED',
  documents: 'AVAILABLE',
  travel: 'NOT_CONNECTED',
};
function render(items: unknown[]) {
  const client = new QueryClient();
  client.setQueryData(
    ['procurement', 'registrations', 'branch-a', '', '', '', 1],
    { items, page: 1, pageSize: 25, hasMore: false },
  );
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <PettyRegistrations bootstrap={bootstrap} onBack={() => undefined} />
    </QueryClientProvider>,
  );
}
describe('Petty registrations list', () => {
  it('renders filtered registration rows, exact amounts and receipt links', () => {
    const html = render([
      {
        id: 'entry-a',
        title: 'Expense receipt',
        costCenter: 'Operations',
        fee: '12.5',
        description: 'Expense details',
        occurredAt: '2026-11-03T00:00:00.000Z',
        amount: '12345678901234567890.1234',
        currencyCode: 'IRR',
        branchId: 'branch-a',
        receiptDocumentId: 'doc-a',
        receiptVersionId: 'version-a',
      },
    ]);
    expect(html).toContain('Expense receipt');
    expect(html).toContain('Operations');
    expect(html).toContain('Expense details');
    expect(html).toContain('۱۲٫۵');
    expect(html).toContain('۱۲٬۳۴۵٬۶۷۸٬۹۰۱٬۲۳۴٬۵۶۷٬۸۹۰٫۱۲۳۴');
    expect(html).toContain('/documents?document=doc-a');
    expect(html).toContain('registration-filter-from-date');
    expect(html).toContain('ثبت جدید');
    expect(html).toContain('<article');
  });
  it('renders a true empty state without sample amounts or receipts', () => {
    const html = render([]);
    expect(html).toContain('نتیجه‌ای پیدا نشد');
    expect(html).not.toContain('<article');
    expect(html).not.toContain('/documents?document=');
  });
});
