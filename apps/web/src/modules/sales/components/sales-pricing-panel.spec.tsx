import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SalesPricingPanel, SalesPricingSummary } from './sales-pricing-panel';
import { cleanSalesMoney, formatSalesMoney } from '@/components/ui/money-input';
describe('sales pricing entry', () => {
  it('reviews exact agreed totals separately for each currency', () => {
    const html = renderToStaticMarkup(
      <SalesPricingSummary
        services={[{ key: 'hotel', title: 'هتل', hotel: true }]}
        nights={3}
        values={{
          hotel: [
            {
              version: 1,
              currencyCode: 'IRR',
              daySale: { basis: 'NIGHT', amount: '2000000' },
              agreed: { basis: 'TOTAL', amount: '5500000' },
            },
            {
              version: 1,
              currencyCode: 'USD',
              daySale: { basis: 'TOTAL', amount: '100' },
              agreed: { basis: 'TOTAL', amount: '95' },
            },
          ],
        }}
      />,
    );
    expect(html).toContain('6,000,000');
    expect(html).toContain('جمع توافق‌شده: 5,500,000 IRR');
    expect(html).toContain('جمع توافق‌شده: 95 USD');
    expect(html).not.toContain('5,500,095');
  });
  it('formats without floating point conversion and normalizes Persian input', () => {
    expect(formatSalesMoney('9007199254740993.1200')).toBe(
      '9,007,199,254,740,993.1200',
    );
    expect(cleanSalesMoney('۱٬۲۳۴٬۵۶۷٫۲۵')).toBe('1234567.25');
    expect(formatSalesMoney('12.')).toBe('12.');
  });
  it('offers nightly and total entry, shows derived totals and removes manual discount selection', () => {
    const html = renderToStaticMarkup(
      <SalesPricingPanel
        services={[{ key: 'hotel', title: 'هتل', hotel: true }]}
        nights={3}
        values={{
          hotel: [
            {
              version: 1,
              currencyCode: 'IRR',
              daySale: { basis: 'NIGHT', amount: '2000000' },
              agreed: { basis: 'TOTAL', amount: '5500000' },
            },
          ],
        }}
        onChange={vi.fn()}
      />,
    );
    expect(html).toContain('ورود قیمت هر شب');
    expect(html).toContain('ورود قیمت کل');
    expect(html).toContain('6,000,000');
    expect(html).toContain('1,833,333.3333');
    expect(html).toContain('500,000');
    expect(html).not.toContain('<select');
    expect(html).toContain('هزینه خرید هتل بعداً');
  });
});
