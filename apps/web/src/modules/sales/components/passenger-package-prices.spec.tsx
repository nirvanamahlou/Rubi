import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { PassengerPackagePrices } from './passenger-package-prices';
import { emptySalesForm } from '../model/sales-form';
describe('Passenger whole-package price entry', () => {
  it('opens one price entry per selected person without inventing amounts', () => {
    const state = {
      ...emptySalesForm,
      passengers: [
        { customerId: 'one', displayName: 'First', birthDate: '1990-01-01' },
        { customerId: 'two', displayName: 'Second', birthDate: '2020-01-01' },
      ],
      priceComponents: [
        {
          type: 'BASE' as const,
          amount: '1000',
          currencyCode: 'IRR',
          title: 'Package',
        },
      ],
    };
    const html = renderToStaticMarkup(
      <PassengerPackagePrices state={state} onChange={vi.fn()} />,
    );
    expect(html).toContain('مبلغ کل First IRR');
    expect(html).toContain('مبلغ کل Second IRR');
    expect((html.match(/inputMode="decimal"/g) || []).length).toBe(2);
    expect(html).toContain('1,000');
    expect(html).toContain('value=""');
  });
});
