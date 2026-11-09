import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ContractFinancialSummaryValues } from './contract-financial-summary';
it('renders authoritative total, confirmed paid and remaining per currency without numeric rounding', () => {
  const html = renderToStaticMarkup(
    <ContractFinancialSummaryValues
      balances={[
        {
          amount: '9007199254740993.25',
          currencyCode: 'IRR',
          confirmedPaid: '1000',
          pendingFinance: '123',
          outstanding: '9007199254739993.25',
        },
        {
          amount: '40',
          currencyCode: 'USD',
          confirmedPaid: '10',
          pendingFinance: '0',
          outstanding: '30',
        },
      ]}
    />,
  );
  expect(html).toContain('9,007,199,254,740,993.25');
  expect(html).toContain('1,000');
  expect(html).toContain('9,007,199,254,739,993.25');
  expect(html.match(/مبلغ کل/g)).toHaveLength(2);
  expect(html.match(/پرداخت‌شده/g)).toHaveLength(2);
  expect(html).not.toContain('123');
});
