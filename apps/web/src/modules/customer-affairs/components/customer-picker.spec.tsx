import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CustomerSummary } from '@rubi/contracts';
import { describe, expect, it } from 'vitest';
import { CustomerPicker } from './customer-picker';

describe('Customers and passengers picker', () => {
  it('shows the selected public customer without exposing an editable ID', () => {
    const selected = {
      id: 'person-1',
      displayName: 'نام انتخاب‌شده',
      maskedPrimaryContact: '***1234',
    } as CustomerSummary;
    const html = renderToStaticMarkup(
      <CustomerPicker selected={selected} onSelect={() => {}} />,
    );
    expect(html).toContain('انتخاب از مشتریان و مسافران');
    expect(html).toContain('نام انتخاب‌شده');
    expect(html).toContain('***1234');
    expect(html).not.toContain('CustomerReference');
    expect(html).not.toContain('name="customerId"');
    expect(html).toContain('href="/customers"');
  });

  it('preserves the current reference while its name is loading', () => {
    const html = renderToStaticMarkup(
      <CustomerPicker
        initialCustomerId="person-1"
        selected={null}
        onSelect={() => {}}
      />,
    );
    expect(html).toContain('در حال دریافت نام مشتری فعلی');
    expect(html).toContain('/customers?customerId=person-1');
    expect(html).toContain('noopener noreferrer');
  });

  it('queries all roles, paginates and guards aborted results', () => {
    const source = readFileSync(
      new URL('./customer-picker.tsx', import.meta.url),
      'utf8',
    );
    expect(source).toContain("role: 'all'");
    expect(source).not.toContain("role: 'customer'");
    expect(source).toContain('response.meta.total');
    expect(source).toContain('page * 10 >= total');
    expect(source).toContain('if (signal?.aborted) return;');
    expect(source).toContain('setPage(1)');
  });
});
