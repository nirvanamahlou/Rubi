import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { Bootstrap } from './api';
import { PettyFundCard, pettyBalanceLabel } from './petty-fund-card';
const bootstrap: Bootstrap = {
  permissions: ['procurement.assign'],
  branches: [{ id: 'branch-1', label: 'دفتر مرکزی' }],
  requester: null,
  policy: 'POLICY_NOT_CONFIGURED',
  defaultBranchId: 'branch-1',
  currencies: [],
  masterData: 'CONNECTED',
  documents: 'AVAILABLE',
  travel: 'NOT_CONNECTED',
};
function render(client: QueryClient) {
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <PettyFundCard bootstrap={bootstrap} />
    </QueryClientProvider>,
  );
}
describe('Independent petty fund card', () => {
  it('preserves all stored money digits without binary floating point rounding', () => {
    expect(pettyBalanceLabel('12345678901234567890.1234')).toBe(
      '۱۲٬۳۴۵٬۶۷۸٬۹۰۱٬۲۳۴٬۵۶۷٬۸۹۰٫۱۲۳۴',
    );
  });
  it('shows the fetched branch balance and currency on its card', () => {
    const client = new QueryClient();
    client.setQueryData(['procurement', 'petty-fund', 'branch-1'], {
      balance: '1250',
      currencyCode: 'IRR',
      version: 2,
      bankName: '',
      accountNumber: '',
      iban: '',
      cardNumber: '',
    });
    const html = render(client);
    expect(html).toContain('تنخواه');
    expect(html).toContain((1250).toLocaleString('fa-IR'));
    expect(html).toContain('IRR');
    expect(html).not.toContain('سفارش‌های خرید');
  });
  it('does not open an empty configuration before the balance has loaded', () => {
    const html = render(new QueryClient());
    expect(html).toContain('در حال دریافت');
    expect(html).toContain('disabled=""');
  });
});
