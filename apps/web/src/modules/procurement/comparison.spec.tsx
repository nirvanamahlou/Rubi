import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QuotationComparison } from './workspace';

describe('Quotation comparison', () => {
  it('shows original exact amounts and warns against cross-currency ranking without FX', () => {
    const html = renderToStaticMarkup(
      <QuotationComparison
        records={[
          {
            id: 'one',
            supplierId: 'supplier-one',
            currencyCode: 'IRR',
            totalAmount: '9007199254740993.1234',
            data: { qualityNote: 'مطابق مشخصات', paymentTerms: 'پس از تحویل' },
          },
          {
            id: 'two',
            supplierId: 'supplier-two',
            currencyCode: 'USD',
            totalAmount: '25.1200',
            data: {},
          },
        ]}
      />,
    );
    expect(html).toContain('9007199254740993.1234');
    expect(html).toContain('25.1200');
    expect(html).toContain('بدون تصویر نرخ ارز معتبر');
    expect(html).toContain('مطابق مشخصات');
    expect(html).toContain('پس از تحویل');
    expect(html).toContain('<caption');
    expect(html).toContain('scope="col"');
  });
});
