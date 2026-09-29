import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  SalesCurrencySelect,
  salesCurrencyOptions,
  defaultSalesCurrency,
  validateSalesCurrencySelection,
} from './sales-currency-select';
import { SearchableReference } from './searchable-reference';

const currencies = [
  { code: 'USD', name: 'دلار', status: 'active' as const },
  { code: 'IRR', name: 'ریال', status: 'active' as const },
  { code: 'EUR', name: 'یورو', status: 'inactive' as const },
];
describe('registered currencies and themed Sales selectors', () => {
  it('uses active registered codes, deduplicates and does not invent a fallback', () => {
    expect(
      salesCurrencyOptions([...currencies, currencies[0]!]).map(
        (item) => item.id,
      ),
    ).toEqual(['USD', 'IRR']);
    expect(defaultSalesCurrency(currencies)).toBe('IRR');
    expect(defaultSalesCurrency([currencies[0]!])).toBe('USD');
    expect(defaultSalesCurrency([])).toBe('');
  });
  it('validates both pricing and payments against the active list', () => {
    const payload = {
      priceComponents: [
        {
          type: 'BASE' as const,
          title: 'خدمت',
          amount: '10',
          currencyCode: 'USD',
        },
      ],
    };
    expect(() =>
      validateSalesCurrencySelection(payload, currencies),
    ).not.toThrow();
    expect(() => validateSalesCurrencySelection(payload, [])).toThrow(
      'ارزهای فعال',
    );
    expect(() =>
      validateSalesCurrencySelection(
        {
          ...payload,
          payments: [
            {
              method: 'CASH',
              amount: '10',
              dueAt: '2026-10-01T00:00:00Z',
              currencyCode: 'EUR',
            },
          ],
        },
        currencies,
      ),
    ).toThrow();
    expect(() =>
      validateSalesCurrencySelection({ priceComponents: [], payments: [] }, []),
    ).not.toThrow();
  });
  it('renders the named currency as a themed combobox, not a free currency value or native select', () => {
    const html = renderToStaticMarkup(
      <SalesCurrencySelect
        label="ارز پرداخت"
        currencies={currencies}
        value="USD"
        onChange={vi.fn()}
      />,
    );
    expect(html).toContain('role="combobox"');
    expect(html).toContain('دلار (USD)');
    expect(html).toContain('rounded-xl');
    expect(html).not.toContain('<select');
  });
  it('reports an unavailable list or a stale selection rather than fabricating one', () => {
    expect(
      renderToStaticMarkup(
        <SalesCurrencySelect
          label="ارز"
          currencies={[]}
          value="IRR"
          onChange={vi.fn()}
        />,
      ),
    ).toContain('فهرست ارزهای فعال در دسترس نیست');
    expect(
      renderToStaticMarkup(
        <SalesCurrencySelect
          label="ارز"
          currencies={currencies}
          value="EUR"
          onChange={vi.fn()}
        />,
      ),
    ).toContain('ارز قبلی فعال نیست');
  });
  it('supports themed payment choices without synthetic Master Data records', () => {
    const html = renderToStaticMarkup(
      <SearchableReference
        label="روش پرداخت"
        value="CASH"
        options={[{ id: 'CASH', name: 'نقد', code: '' }]}
        onChange={vi.fn()}
      />,
    );
    expect(html).toContain('role="combobox"');
    expect(html).toContain('value="نقد"');
    expect(html).not.toContain('<select');
  });
});
