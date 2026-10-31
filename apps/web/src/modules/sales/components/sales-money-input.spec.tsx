import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { SalesMoneyInput } from './sales-money-input';

it('links live words below the input while retaining the original monetary value', () => {
  const html = renderToStaticMarkup(
    <SalesMoneyInput
      aria-label="قیمت ریالی"
      value="25000"
      currencyCode="IRR"
      onValueChange={vi.fn()}
    />,
  );
  expect(html).toContain('value="25,000"');
  expect(html).toContain('بیست و پنج هزار ریال');
  expect(html).toContain('aria-describedby=');
  expect(html).toContain('aria-live="polite"');
  expect(html.indexOf('بیست و پنج هزار ریال')).toBeGreaterThan(
    html.indexOf('<input'),
  );
});
it('clears the words on empty input and updates the currency without altering the amount', () => {
  const render = (value: string, currencyCode: string) =>
    renderToStaticMarkup(
      <SalesMoneyInput
        value={value}
        currencyCode={currencyCode}
        onValueChange={vi.fn()}
      />,
    );
  expect(render('', 'IRR')).not.toContain('aria-live');
  expect(render('25', 'USD')).toContain('بیست و پنج دلار آمریکا');
  expect(render('25', 'IRR')).toContain('بیست و پنج ریال');
});
