import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CustomerBasicFields } from './customer-basic-fields';
describe('customer-only entry', () => {
  it('requests only four named customer fields with no passenger identity requirements', () => {
    const html = renderToStaticMarkup(
      <CustomerBasicFields
        values={{
          firstName: 'Synthetic',
          lastName: 'Customer',
          phone: '09123456789',
          address: 'Synthetic address',
        }}
        onChange={() => {}}
      />,
    );
    expect(html.match(/<input /g)).toHaveLength(4);
    for (const label of ['نام', 'نام خانوادگی', 'شماره تماس', 'نشانی و آدرس'])
      expect(html).toContain('aria-label="' + label + '"');
    expect(html).not.toMatch(/national|passport|birth|email/);
    expect(html.match(/required=""/g)).toHaveLength(4);
  });
});
