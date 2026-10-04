import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SalesPricingPanel, SalesPricingSummary } from './sales-pricing-panel';
import { cleanSalesMoney, formatSalesMoney } from '@/components/ui/money-input';
describe('sales pricing entry', () => {
  it('locks catalog ticket sale price while keeping the agreed amount editable', () => {
    const fare = {
      version: 1 as const,
      currencyCode: 'IRR',
      daySale: { basis: 'TOTAL' as const, amount: '250000000' },
      agreed: { basis: 'TOTAL' as const, amount: '240000000' },
    };
    const html = renderToStaticMarkup(
      <SalesPricingPanel
        currencies={[{ code: 'IRR', name: 'ریال', status: 'active' }]}
        services={[{ key: 'flight-outbound', title: 'بلیط رفت', hotel: false }]}
        nights={0}
        values={{ 'flight-outbound': [fare] }}
        fixedSalePrices={{ 'flight-outbound': [fare] }}
        onChange={vi.fn()}
      />,
    );
    expect(html).toContain('نرخ فروش از قیمت بلیط ثبت‌شده می‌آید');
    expect(html).toMatch(/قیمت روز فروش بلیط رفت کل[^>]*readOnly=""/);
    expect(html).toContain('aria-label="مبلغ توافق‌شده با مشتری بلیط رفت کل"');
    expect(html).not.toContain('افزودن ارز');
  });
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
        currencies={[{ code: 'IRR', name: 'ریال', status: 'active' }]}
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

it('new-contract mode shows read-only sale prices equal to agreed values for flights and hotels', () => {
  const html = renderToStaticMarkup(
    <SalesPricingPanel
      salePriceFromAgreed
      currencies={[{ code: 'IRR', name: 'ریال', status: 'active' }]}
      services={[
        { key: 'flight', title: 'بلیط', hotel: false },
        { key: 'hotel', title: 'هتل', hotel: true },
      ]}
      nights={3}
      values={{
        flight: [
          {
            version: 1,
            currencyCode: 'IRR',
            daySale: { basis: 'TOTAL', amount: '100' },
            agreed: { basis: 'TOTAL', amount: '95' },
          },
        ],
        hotel: [
          {
            version: 1,
            currencyCode: 'IRR',
            daySale: { basis: 'NIGHT', amount: '200' },
            agreed: { basis: 'TOTAL', amount: '550' },
          },
        ],
      }}
      onChange={vi.fn()}
    />,
  );
  expect(html).toMatch(/قیمت روز فروش بلیط کل[^>]*readOnly=""[^>]*value="95"/);
  expect(html).toMatch(/قیمت روز فروش هتل کل[^>]*readOnly=""[^>]*value="550"/);
  expect(html.match(/readOnly=""/g)).toHaveLength(2);
  expect(html.match(/ورود قیمت هر شب/g)).toHaveLength(1);
  expect(html).toContain('قابل پرداخت: 550');
});
