import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { emptySalesForm } from '../model/sales-form';
import { SalesChequeCalculator } from './sales-cheque-calculator';

describe('sales cheque calculator', () => {
  it('offers cash and cheque sale without a calculator in cash mode', () => {
    const html = renderToStaticMarkup(
      <SalesChequeCalculator state={emptySalesForm} onChange={vi.fn()} />,
    );
    expect(html).toContain('نقدی');
    expect(html).toContain('چکی');
    expect(html).not.toContain('محاسبه و اعمال');
  });
  it('shows the exact financed total and first monthly cheque date from the draft', () => {
    const html = renderToStaticMarkup(
      <SalesChequeCalculator
        state={{
          ...emptySalesForm,
          departureDate: '2026-10-31',
          priceComponents: [
            {
              type: 'BASE',
              title: 'خدمات',
              amount: '100000000',
              currencyCode: 'IRR',
            },
          ],
          paymentTerms: {
            version: 1,
            mode: 'CHECK',
            plans: [
              {
                currencyCode: 'IRR',
                downPayment: '30000000',
                months: 3,
                firstDueDate: '2026-11-30',
              },
            ],
          },
        }}
        onChange={vi.fn()}
      />,
    );
    expect(html).toContain('110,500,000');
    expect(html).toContain('10,500,000');
    expect(html).toContain('2026-11-30');
    expect(html).toContain('2027-01-30');
    expect(html).toContain('حداقل پیش‌پرداخت ۳۰٪');
    expect(html).toContain('محاسبه و اعمال برنامه چک‌ها');
  });
});
