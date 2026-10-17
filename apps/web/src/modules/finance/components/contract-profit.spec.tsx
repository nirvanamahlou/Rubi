import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import type { SalesContractProfitV1 } from '@nora/contracts';
import { formatSalesMoney } from '@/components/ui/money-input';
import { ContractProfit, ContractProfitDetails } from './contract-profit';

const value: SalesContractProfitV1 = {
  version: 1,
  complete: false,
  missingServiceKeys: ['return'],
  missingServiceTitles: ['بلیط برگشت'],
  totals: [
    {
      currencyCode: 'IRR',
      salesAmount: '450000000',
      purchaseAmount: '0',
      profitAmount: null,
    },
    {
      currencyCode: 'USD',
      salesAmount: '100',
      purchaseAmount: '0',
      profitAmount: null,
    },
  ],
  costs: [
    {
      serviceClientKeys: ['hotel'],
      serviceTitles: ['هتل'],
      source: 'RESERVATIONS',
      referenceId: 'synthetic',
      amount: '12.50',
      currencyCode: 'EUR',
    },
  ],
};

it('frames separate currencies and isolates numeric direction without inventing incomplete profit', () => {
  const html = renderToStaticMarkup(<ContractProfitDetails value={value} />);
  expect(html).toContain('dir="rtl"');
  expect(html.match(/scope="col"/g)).toHaveLength(4);
  expect(html.match(/scope="row"/g)).toHaveLength(2);
  expect(html).toContain(`<bdi dir="ltr"`);
  expect(html).toContain(formatSalesMoney('450000000'));
  expect(html).toContain('IRR');
  expect(html).toContain('USD');
  expect(html.match(/در انتظار تکمیل هزینه‌ها/g)).toHaveLength(2);
  expect(html).toContain('role="status"');
  expect(html).toContain('<li>بلیط برگشت</li>');
  expect(html).toContain('خرید رزرواسیون');
  expect(html).toContain(formatSalesMoney('12.50'));
});

it('preserves signed and large exact amounts and both cost sources', () => {
  const html = renderToStaticMarkup(
    <ContractProfitDetails
      value={{
        ...value,
        complete: true,
        totals: [
          {
            currencyCode: 'USD',
            salesAmount: '9007199254740993.25',
            purchaseAmount: '9007199254740994.50',
            profitAmount: '-1.25',
          },
        ],
        costs: [{ ...value.costs[0]!, source: 'FINANCE_TICKET' }],
      }}
    />,
  );
  expect(html).toContain(formatSalesMoney('9007199254740993.25'));
  expect(html).toContain(formatSalesMoney('-1.25'));
  expect(html).not.toContain('در انتظار تکمیل هزینه‌ها');
  expect(html).not.toContain('role="status"');
  expect(html).toContain('خرید بلیت ثبت‌شده در مالی');
});

it('does not expose unloaded financial data in the collapsed control', () => {
  const html = renderToStaticMarkup(<ContractProfit id="synthetic" />);
  expect(html).toContain('aria-expanded="false"');
  expect(html).not.toContain('<table');
});

it('contains narrow-screen overflow within the table frame and spaces every cell', () => {
  const css = readFileSync(
    new URL('./contract-profit.module.css', import.meta.url),
    'utf8',
  );
  expect(css).toContain('overflow-x: auto');
  expect(css).toContain('table-layout: auto');
  expect(css).toContain('font-variant-numeric: tabular-nums');
  expect(css).toContain('border-inline-end: 1px solid var(--border)');
});
